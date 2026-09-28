#!/usr/bin/env python3
"""
USThing App Tech Test — dataset preprocessor.

Reads the supplied ``courses.json`` (≈28 MB, 15,178 term offerings from the
UST Archive catalog, 4 terms) and emits compact, indexed assets that the
Expo app bundles locally:

  app/data/meta.json          departments, terms, parser/QA stats
  app/data/catalog.json       one slim record per course (list/search/filter)
  app/data/graph.json         reverse prerequisite edges ("what this unlocks")
  app/data/details/<PFX>.json detail shards, lazy-loaded per department
  app/data/details/index.ts   static require map for the shards

Course identity is (prefix, number): the same course is listed once per term,
so offerings are merged with the newest term winning (2610 > 2540 > 2530 >
2520).  Prerequisite / corequisite / exclusion text is parsed into DNF over
course codes by a parser adapted from the author's previous project (rouste),
extended for this catalog: '/' acts as OR, grade and HKDSE/IELTS/Gaokao
qualifiers are stripped, and the original text is always kept for display.
"""
from __future__ import annotations

import collections
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "courses.json")
OUT_DIR = os.path.join(ROOT, "app", "data")
DETAILS_DIR = os.path.join(OUT_DIR, "details")

# Newest term wins when merging offerings of the same course.
TERM_ORDER = ["2610", "2540", "2530", "2520"]

# Department display names, reused from the author's earlier course planner
# (rouste): the UST Archive dataset only carries codes and nicknames.
PREFIX_NAMES = {
    "ACCT": "Accounting",
    "AISC": "Interdisciplinary Studies",
    "AMCC": "Arts and Machine Creativity",
    "BIBU": "Biotechnology and Business",
    "BIEN": "Bioengineering",
    "CENG": "Chemical and Biological Engineering",
    "CHEM": "Chemistry",
    "CIVL": "Civil and Environmental Engineering",
    "COMP": "Computer Science and Engineering",
    "CPEG": "Computer Engineering",
    "CTDL": "Critical Thinking and Data Literacy",
    "DASC": "Data Analytics in Science",
    "DSCT": "Data Science and Technology",
    "ECON": "Economics",
    "ELEC": "Electronic and Computer Engineering",
    "EMIA": "Emerging Interdisciplinary Areas",
    "ENEG": "Energy",
    "ENGG": "School of Engineering",
    "ENTR": "Entrepreneurship",
    "ENVR": "Environment",
    "ENVS": "Environmental Science",
    "FINA": "Finance",
    "GBUS": "Global Business",
    "GNED": "General Education",
    "HART": "Studio Arts courses offered by HUMA",
    "HLTH": "Health and Physical Education",
    "HMAW": "Habits, Mindsets, and Wellness",
    "HUMA": "Humanities",
    "IEDA": "Industrial Engineering and Decision Analytics",
    "IIMP": "Individualized Interdisciplinary Major",
    "IROP": "International Research Opportunities Program",
    "ISDN": "Integrative Systems and Design",
    "ISOM": "Information Systems, Business Statistics and Operations Management",
    "LABU": "Language for Business",
    "LANG": "Language",
    "LEGL": "Legal Education",
    "LIFS": "Life Science",
    "MARK": "Marketing",
    "MATH": "Mathematics",
    "MECH": "Mechanical and Aerospace Engineering",
    "MGMT": "Management",
    "OCES": "Ocean Science",
    "PHYS": "Physics",
    "PPOL": "Public Policy",
    "RMBI": "Risk Management and Business Intelligence",
    "SBMT": "School of Business and Management",
    "SCIE": "School of Science",
    "SGFN": "Sustainable and Green Finance",
    "SHSS": "School of Humanities and Social Science",
    "SISP": "Summer Institute for Secondary School Students",
    "SOSC": "Social Science",
    "SUST": "Sustainability",
    "TEMG": "Technology and Management",
    "UCOP": "Undergraduate Global Challenges and Opportunities Program",
    "UPOP": "Undergraduate Practice Opportunities Program",
    "UROP": "Undergraduate Research Opportunities Program",
    "UTOP": "Undergraduate Teaching Opportunities Program",
    "WBBA": "SF Program in World Business",
}

# ---------------------------------------------------------------------------
# Prerequisite / corequisite / exclusion parsing (adapted from rouste)
# ---------------------------------------------------------------------------

TOKEN_CODE, TOKEN_AND, TOKEN_OR = "CODE", "AND", "OR"
COURSE_CODE_RE = re.compile(r"([A-Z]{4})\s*(\d{4}[A-Z]?)")


def extract_codes(text: str) -> list[str]:
    """All course codes appearing in a free-text string, deduped, ordered."""
    out, seen = [], set()
    for m in COURSE_CODE_RE.finditer(text or ""):
        code = m.group(1) + m.group(2)
        if code not in seen:
            seen.add(code)
            out.append(code)
    return out


def clean_condition_text(raw: str) -> str:
    """Strip qualifiers that cannot be represented as course codes.

    Course codes inside the stripped phrases are kept where meaningful
    (e.g. "MATH 1012 (prior to 2025-26) OR MATH 1013" -> "MATH 1013").
    """
    t = raw
    # Outdated "prior to/before YYYY" parentheticals (keep the code itself).
    t = re.sub(r"\([^)]*\b(?:prior to|before)\s+\d{4}[^)]*\)", " ", t, flags=re.I)
    # Parenthetical groups containing no course code are qualifiers rather
    # than logic — "(for non-BIBU students)", "(a)", "(Level 3 in HKDSE …)".
    # Left in place they parse to an empty factor and swallow everything
    # after them, so drop them (the raw text is still shown in the UI).
    for _ in range(4):
        stripped = re.sub(
            r"\([^()]*\)",
            lambda m: " " if not COURSE_CODE_RE.search(m.group(0)) else m.group(0),
            t,
        )
        if stripped == t:
            break
        t = stripped
    # "; and" / "; or" — the semicolon is redundant next to the operator.
    t = re.sub(r"[;,]\s*(AND|OR)\b", r" \1", t, flags=re.I)
    # A bare ';' joins parallel requirement groups ("(for Science students)
    # X; (for Engineering students) Y"), which reads as OR.
    t = t.replace(";", " OR ")
    # Grade qualifiers: "Grade A- or above in PHYS 1111" -> "PHYS 1111".
    t = re.sub(r"\bGrade\s+[A-F][+-]?\s+(?:or\s+(?:above|below)\s+)?in\s+", " ", t, flags=re.I)
    # Stray/repeated operators left behind by the removals above.
    t = re.sub(r"\b(OR|AND)\b(?:\s*\b(?:OR|AND)\b)+", r"\1", t, flags=re.I)
    t = re.sub(r"^\s*(OR|AND)\s+", "", t, flags=re.I)
    t = re.sub(r"\s+(OR|AND)\s*$", "", t, flags=re.I)
    t = re.sub(r"\(\s*\)", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def tokenize(text: str) -> list[dict]:
    tokens: list[dict] = []
    i = 0
    n = len(text)

    def word_at(pos: int, word: str) -> bool:
        """True when `word` sits at `pos` as a standalone token.

        Guards against substring matches: without this, the "or" inside
        "(For students without prerequisites)" is read as an OR operator
        and the whole condition fails to parse (or "BAND" as AND).
        """
        if text[pos : pos + len(word)].upper() != word:
            return False
        before_ok = pos == 0 or not text[pos - 1].isalpha()
        after_ok = pos + len(word) >= n or not text[pos + len(word)].isalpha()
        return before_ok and after_ok

    while i < n:
        ch = text[i]
        if ch.isspace() or ch in ",;":
            i += 1
            continue
        if ch in "()":
            tokens.append({"type": ch, "val": ch})
            i += 1
            continue
        if word_at(i, "AND"):
            tokens.append({"type": TOKEN_AND, "val": "AND"})
            i += 3
            continue
        if word_at(i, "OR"):
            tokens.append({"type": TOKEN_OR, "val": "OR"})
            i += 2
            continue
        # NEW vs rouste: '/' and '\\' are used as OR in this catalog
        # e.g. "(MATH 2011 / MATH 2023) AND ...".
        if ch in "/\\":
            tokens.append({"type": TOKEN_OR, "val": "OR"})
            i += 1
            continue
        m = COURSE_CODE_RE.match(text[i:])
        if m:
            tokens.append({"type": TOKEN_CODE, "val": m.group(1) + m.group(2)})
            i += m.end()
            continue
        i += 1
    return tokens


def parse_expr_to_dnf(tokens: list[dict]) -> list[list[str]]:
    """Recursive-descent boolean parser -> disjunctive normal form."""
    pos = 0

    def parse_factor():
        nonlocal pos
        if pos < len(tokens) and tokens[pos]["type"] == "(":
            pos += 1
            node = parse_or()
            if pos < len(tokens) and tokens[pos]["type"] == ")":
                pos += 1
            return node
        if pos < len(tokens) and tokens[pos]["type"] == TOKEN_CODE:
            code = tokens[pos]["val"]
            pos += 1
            return [[code]]
        return []

    def dist(a, b):
        if not a:
            return b
        if not b:
            return a
        return [x + y for x in a for y in b]

    def parse_and():
        nonlocal pos
        left = parse_factor()
        while pos < len(tokens) and tokens[pos]["type"] == TOKEN_AND:
            pos += 1
            left = dist(left, parse_factor())
        return left

    def parse_or():
        nonlocal pos
        left = parse_and()
        while pos < len(tokens) and tokens[pos]["type"] == TOKEN_OR:
            pos += 1
            left = left + parse_and()
        return left

    return parse_or()


def _has_non_course_condition(text: str) -> bool:
    """True when the text still carries conditions we cannot model as codes
    (HKDSE/IELTS/Gaokao scores, standing, instructor approval, ...)."""
    leftover = COURSE_CODE_RE.sub(" ", text)
    # Boolean operators are logic, not a condition ("AND" is three letters
    # and would otherwise be flagged).
    leftover = re.sub(r"\b(?:AND|OR)\b", " ", leftover, flags=re.I)
    leftover = re.sub(r"[\s()/,;.\-+']", " ", leftover)
    return bool(re.search(r"[A-Za-z]{3,}", leftover))


def parse_condition(raw: str) -> tuple[list, bool]:
    """Parse a condition string into DNF over course codes.

    Returns (dnf, partial) where ``partial`` is True when non-course
    conditions were detected (the raw text is kept for display).
    """
    if not raw or not raw.strip():
        return [], False
    # Flag unresolvable conditions from the *original* text: cleaning drops
    # qualifiers like "(for non-BIBU students)" that the UI must still show.
    partial = _has_non_course_condition(raw)
    cleaned = clean_condition_text(raw)
    if not cleaned:
        return [], partial
    try:
        dnf = parse_expr_to_dnf(tokenize(cleaned))
    except Exception:  # pragma: no cover - defensive, mirrors rouste
        return [], True
    out: list = []
    for group in dnf:
        uniq, seen = [], set()
        for c in group:
            if c not in seen:
                seen.add(c)
                uniq.append(c)
        if len(uniq) == 1:
            out.append(uniq[0])
        elif uniq:
            out.append(uniq)
    return out, partial


# ---------------------------------------------------------------------------
# Merge + emit
# ---------------------------------------------------------------------------

def course_credits(offering: dict):
    mn, mx = offering.get("min_credits"), offering.get("max_credits")
    if mn is None and mx is None:
        return None
    if mn == mx:
        return mn
    return f"{mn:g}-{mx:g}" if isinstance(mn, float) else f"{mn}-{mx}"

def main() -> int:
    t0 = time.time()
    if not os.path.isfile(SRC):
        print(f"error: {SRC} not found", file=sys.stderr)
        return 1
    with open(SRC, encoding="utf-8") as fh:
        offerings = json.load(fh)
    print(f"loaded {len(offerings)} offerings from courses.json")

    def term_rank(tc: str) -> int:
        return TERM_ORDER.index(tc) if tc in TERM_ORDER else len(TERM_ORDER)

    # ---- group offerings by (prefix, number) ------------------------------
    groups: dict[str, list[dict]] = collections.defaultdict(list)
    for o in offerings:
        groups[f"{o.get('prefix','').strip()}{o.get('number','').strip()}"].append(o)

    terms_seen: dict[str, str] = {}
    dept_counts: collections.Counter = collections.Counter()
    dept_names: dict[str, str] = {}
    dept_of_prefix: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)

    catalog: dict[str, dict] = {}
    details: dict[str, dict] = {}
    stats = collections.Counter()
    unresolved_codes: collections.Counter = collections.Counter()
    all_codes = set(groups.keys())

    for code, offs in sorted(groups.items()):
        offs.sort(key=lambda o: term_rank(o.get("term_code", "")))
        newest = offs[0]

        prefix = (newest.get("prefix") or code[:4]).strip()
        number = (newest.get("number") or code[4:]).strip()
        terms = sorted({o.get("term_code", "") for o in offs}, key=term_rank)
        for o in offs:
            terms_seen[o.get("term_code", "")] = o.get("term_name", "")
        dept = (newest.get("department_code") or prefix).strip()
        dept_counts[dept] += 1
        dept_names.setdefault(dept, (newest.get("department_nickname") or dept).strip())
        dept_of_prefix[prefix][dept] += 1

        try:
            level = int(number[0])
        except (ValueError, IndexError):
            level = 0

        credits = course_credits(newest)

        attrs = newest.get("attributes") or []
        cc = [a.get("label") for a in attrs if a.get("label")]
        cc_set = {l for l in cc if l in ("4Y", "CC22", "CC25", "CC26")}

        prereq_raw = (newest.get("prerequisite") or "").strip()
        coreq_raw = (newest.get("corequisite") or "").strip()
        excl_raw = (newest.get("exclusion") or "").strip()

        prereq_dnf, prereq_partial = parse_condition(prereq_raw)
        coreq_dnf, coreq_partial = parse_condition(coreq_raw)
        excl_codes = extract_codes(excl_raw)

        for c in set(extract_codes(prereq_raw) + extract_codes(coreq_raw) + excl_codes):
            if c not in all_codes:
                unresolved_codes[c] += 1

        if prereq_dnf:
            stats["with_prereq"] += 1
        if prereq_partial:
            stats["prereq_partial"] += 1
        if coreq_dnf:
            stats["with_coreq"] += 1
        if excl_codes:
            stats["with_excl"] += 1
        if cc_set:
            stats["common_core"] += 1

        # ---- per-term variants --------------------------------------------
        # Requirements change between terms (117 courses carry a different
        # prerequisite text in different terms).  `newest` is the base;
        # per-term overrides are stored sparsely so the app can let the user
        # switch terms without discarding data.
        cat_variants: dict[str, dict] = {}
        det_variants: dict[str, dict] = {}
        for o in offs[1:]:
            t = o.get("term_code", "")
            cv: dict = {}
            dv: dict = {}
            title = (o.get("title") or "").strip()
            if title != (newest.get("title") or "").strip():
                cv["t"] = title
            cr = course_credits(o)
            if cr != credits:
                cv["cr"] = cr
            desc = (o.get("description") or "").strip()
            if desc != (newest.get("description") or "").strip():
                dv["d"] = desc
            pq = (o.get("prerequisite") or "").strip()
            if pq != prereq_raw:
                pqd, pqx = parse_condition(pq)
                dv["pq"] = pq
                dv["pqd"] = pqd
                if pqx:
                    dv["pqx"] = 1
            cq = (o.get("corequisite") or "").strip()
            if cq != coreq_raw:
                cqd, cqx = parse_condition(cq)
                dv["cq"] = cq
                dv["cqd"] = cqd
                if cqx:
                    dv["cqx"] = 1
            ex = (o.get("exclusion") or "").strip()
            if ex != excl_raw:
                dv["ex"] = ex
            if cv:
                cat_variants[t] = cv
            if dv:
                det_variants[t] = dv
        if cat_variants or det_variants:
            stats["term_variants"] += 1

        catalog[code] = {
            "c": code,
            "t": (newest.get("title") or "").strip(),
            "p": prefix,
            "d": dept,
            "cr": credits,
            "lv": level,
            "tm": terms,
            "pr": 1 if prereq_dnf else 0,
            "cq": 1 if coreq_dnf else 0,
            "cc": sorted(cc_set),
        }
        if cat_variants:
            catalog[code]["tv"] = cat_variants

        detail: dict = {}
        desc = (newest.get("description") or "").strip()
        if desc:
            detail["d"] = desc
        cilos = [c.get("description", "").strip() for c in (newest.get("cilos") or []) if c.get("description")]
        if cilos:
            detail["cl"] = cilos
        if prereq_raw:
            detail["pq"] = prereq_raw
            detail["pqd"] = prereq_dnf
            if prereq_partial:
                detail["pqx"] = 1
        if coreq_raw:
            detail["cq"] = coreq_raw
            detail["cqd"] = coreq_dnf
            if coreq_partial:
                detail["cqx"] = 1
        if excl_raw:
            detail["ex"] = excl_raw
        if attrs:
            detail["at"] = [
                {"l": a.get("label", ""), "v": a.get("value", ""), "d": a.get("description", "")}
                for a in attrs
            ]
        if det_variants:
            detail["tv"] = det_variants
        details[code] = detail

    # ---- reverse graph ("what this course unlocks") -----------------------
    graph: dict[str, list[str]] = collections.defaultdict(list)
    for code, detail in details.items():
        for group in detail.get("pqd", []):
            for c in [group] if isinstance(group, str) else group:
                if c in catalog and code not in graph[c]:
                    graph[c].append(code)
    for k in graph:
        graph[k].sort()
    stats["unlock_edges"] = sum(len(v) for v in graph.values())

    # ---- write outputs ----------------------------------------------------
    os.makedirs(DETAILS_DIR, exist_ok=True)

    def dump(path: str, obj) -> int:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
        size = os.path.getsize(path)
        print(f"  wrote {os.path.relpath(path, ROOT):48s} {size/1024:8.1f} KB")
        return size

    total = 0
    total += dump(os.path.join(OUT_DIR, "catalog.json"), catalog)
    total += dump(os.path.join(OUT_DIR, "graph.json"), dict(sorted(graph.items())))

    shards: dict[str, dict] = collections.defaultdict(dict)
    for code, detail in details.items():
        shards[code[:4].upper()][code] = detail
    index_lines = [
        "// AUTO-GENERATED by scripts/preprocess.py — do not edit by hand.",
        "// Detail shards keyed by course prefix; lazy-loaded via require().",
        "export const DETAIL_SHARDS: Record<string, () => Record<string, unknown>> = {",
    ]
    for prefix in sorted(shards):
        safe = re.sub(r"[^A-Z0-9]", "_", prefix)
        total += dump(os.path.join(DETAILS_DIR, f"{safe}.json"), dict(sorted(shards[prefix].items())))
        index_lines.append(f"  {json.dumps(prefix)}: () => require({json.dumps('./' + safe + '.json')}),")
    index_lines.append("}")
    with open(os.path.join(DETAILS_DIR, "index.ts"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(index_lines) + "\n")
    print(f"  wrote {'app/data/details/index.ts':48s} (static require map)")

    meta = {
        "source": "courses.json (UST Archive catalog, supplied with the test)",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "stats": {
            "offerings": len(offerings),
            "courses": len(catalog),
            "departments": len(dept_counts),
            "withPrereq": stats["with_prereq"],
            "prereqPartial": stats["prereq_partial"],
            "withCoreq": stats["with_coreq"],
            "withExclusion": stats["with_excl"],
            "commonCore": stats["common_core"],
            "termVariantCourses": stats["term_variants"],
            "unlockEdges": stats["unlock_edges"],
            "unresolvedCodes": len(unresolved_codes),
        },
        "terms": [{"code": t, "name": terms_seen.get(t, t)} for t in sorted(terms_seen, key=term_rank)],
        "departments": [
            {"code": d, "name": dept_names.get(d, d), "count": n}
            for d, n in sorted(dept_counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ],
        "prefixToDept": {
            p: dept_of_prefix[p].most_common(1)[0][0] for p in sorted(dept_of_prefix)
        },
        "prefixNames": {
            p: PREFIX_NAMES.get(p)
            or dept_names.get(dept_of_prefix[p].most_common(1)[0][0], p)
            for p in sorted(dept_of_prefix)
        },
    }
    dump(os.path.join(OUT_DIR, "meta.json"), meta)

    print(f"\nstats: {json.dumps(meta['stats'], indent=2)}")
    print(f"terms: {meta['terms']}")
    print(f"departments (school-level): {len(meta['departments'])}, prefixes: {len(meta['prefixToDept'])}")
    if unresolved_codes:
        top = unresolved_codes.most_common(12)
        print(f"codes referenced but not in catalog (top): {top}")
    print(f"\ntotal app data: {total/1024/1024:.2f} MB   ({time.time()-t0:.1f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
