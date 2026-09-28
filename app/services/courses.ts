/**
 * Local course data access — no backend, everything ships with the app.
 *
 * `scripts/preprocess.py` turns the supplied 28 MB `courses.json`
 * (15,178 offerings over 4 terms) into ~4.6 MB of indexed assets:
 *
 *   data/catalog.json       4,030 courses — list / search / filter
 *   data/graph.json         reverse prerequisite edges ("what this unlocks")
 *   data/details/<PFX>.json detail shards (description, CILOs, DNF
 *                           prerequisites) — lazily loaded per prefix
 *   data/meta.json          departments, terms, parser stats
 *
 * Term semantics: a course is listed once per term it runs in (`tm`), and
 * ~315 courses differ between terms (title, credits, description,
 * prerequisites). The base record is the newest term; per-term overrides
 * live in `tv` and are applied by `resolveCourse` / `resolveDetail`, so
 * switching terms in the UI never discards data.
 */
import catalogJson from "@/data/catalog.json"
import { DETAIL_SHARDS } from "@/data/details/index"
import graphJson from "@/data/graph.json"
import metaJson from "@/data/meta.json"

/** DNF over course codes: an OR of AND-groups; a bare string is a single
 * course that satisfies the condition on its own. */
export type PrereqDnf = Array<string | string[]>

export interface CatalogCourse {
  /** course code, e.g. "COMP1021" */
  c: string
  /** title */
  t: string
  /** prefix, e.g. "COMP" — the department filter bucket */
  p: string
  /** owning department code (school-level), e.g. "CSE" */
  d: string
  /** credits: number, "min-max" string for variable-credit courses, or null */
  cr: number | string | null
  /** level (first digit of the course number) */
  lv: number
  /** terms the course is offered in, newest first */
  tm: string[]
  /** has parseable prerequisites */
  pr: 0 | 1
  /** has corequisites */
  cq: 0 | 1
  /** Common Core / cohort attribute labels */
  cc: string[]
  /** per-term overrides (title / credits) */
  tv?: Record<string, Partial<Pick<CatalogCourse, "t" | "cr">>>
}

export interface CourseDetail {
  /** description */
  d?: string
  /** CILOs (intended learning outcomes) */
  cl?: string[]
  /** raw prerequisite text, exactly as published */
  pq?: string
  /** parsed prerequisite DNF */
  pqd?: PrereqDnf
  /** prerequisite text carries conditions we cannot model as courses */
  pqx?: 1
  /** raw corequisite text + DNF */
  cq?: string
  cqd?: PrereqDnf
  /** raw exclusion text */
  ex?: string
  /** catalog attributes (Common Core frameworks, DELI/READ/MEDI...) */
  at?: { l: string; v: string; d: string }[]
  /** per-term overrides (description / conditions) */
  tv?: Record<string, Partial<Omit<CourseDetail, "tv">>>
}

export interface Meta {
  source: string
  generatedAt: string
  stats: Record<string, number>
  terms: { code: string; name: string }[]
  departments: { code: string; name: string; count: number }[]
  prefixToDept: Record<string, string>
}

/** A catalog course plus derived search keys (built once at module load). */
export interface CourseRow extends CatalogCourse {
  codeNorm: string
  titleLower: string
}

export const meta = metaJson as unknown as Meta
export const catalog = catalogJson as unknown as Record<string, CatalogCourse>

const graph = graphJson as unknown as Record<string, string[]>

export const normalizeCode = (s: string) => s.replace(/[\s\-_]/g, "").toUpperCase()

export const courseList: CourseRow[] = Object.values(catalog)
  .map((c) => ({ ...c, codeNorm: normalizeCode(c.c), titleLower: (c.t || "").toLowerCase() }))
  .sort((a, b) => a.c.localeCompare(b.c))

const byCode = new Map(courseList.map((c) => [c.c, c]))

export const getCourse = (code: string): CourseRow | undefined => byCode.get(code)

// ---------------------------------------------------------------------------
// Term-aware resolution
// ---------------------------------------------------------------------------

/** Fields of a course as they stood in the given term. */
export function resolveCourse(code: string, term: string): CourseRow | undefined {
  const c = byCode.get(code)
  if (!c) return undefined
  const tv = term ? c.tv?.[term] : undefined
  if (!tv) return c
  return { ...c, ...tv, codeNorm: c.codeNorm, titleLower: (tv.t ?? c.t ?? "").toLowerCase() }
}

// ---------------------------------------------------------------------------
// Detail shards (lazy, cached per prefix)
// ---------------------------------------------------------------------------

const shardCache = new Map<string, Record<string, CourseDetail>>()

export function getDetail(code: string): CourseDetail | undefined {
  const prefix = code.slice(0, 4).toUpperCase()
  let shard = shardCache.get(prefix)
  if (!shard) {
    const loader = DETAIL_SHARDS[prefix]
    if (!loader) return undefined
    shard = loader() as Record<string, CourseDetail>
    shardCache.set(prefix, shard)
  }
  return shard[code]
}

/** Detail fields of a course as they stood in the given term. */
export function resolveDetail(code: string, term: string): CourseDetail | undefined {
  const d = getDetail(code)
  if (!d) return undefined
  const tv = term ? d.tv?.[term] : undefined
  if (!tv) return d
  return { ...d, ...tv }
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

/** Courses that list `code` as a prerequisite ("what this unlocks"). */
export const getUnlocks = (code: string): string[] => graph[code] ?? []

/** Course codes appearing in free text (e.g. an exclusion string). */
export function extractCodes(text?: string): string[] {
  if (!text) return []
  const matches = text.toUpperCase().match(/[A-Z]{4}\s?\d{4}[A-Z]?/g) ?? []
  return [...new Set(matches.map((m) => m.replace(/\s/g, "")))]
}

/** Flatten a DNF into the set of course codes it mentions. */
export function flattenDnf(dnf?: PrereqDnf): string[] {
  if (!dnf) return []
  const out: string[] = []
  for (const g of dnf) {
    if (Array.isArray(g)) out.push(...g)
    else out.push(g)
  }
  return out
}

/** Every prerequisite code of a course in a term (recursive resolution is
 * done by the UI; this is one level). */
export function prereqCodesOf(code: string, term: string): string[] {
  return flattenDnf(resolveDetail(code, term)?.pqd)
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface CourseQuery {
  term: string
  /** prefix filter (e.g. "COMP") */
  prefix?: string
  /** only Common Core courses */
  commonCore?: boolean
  /** free text — matches code ("comp2011", "comp 2011") or title words */
  text?: string
}

export function queryCourses({ term, prefix, commonCore, text }: CourseQuery): CourseRow[] {
  const q = (text ?? "").trim()
  const codeQ = normalizeCode(q)
  const textQ = q.toLowerCase()
  const tokens = textQ.split(/\s+/).filter(Boolean)

  return courseList.filter((c) => {
    if (term && !c.tm.includes(term)) return false
    if (prefix && c.p !== prefix) return false
    if (commonCore && c.cc.length === 0) return false
    if (!q) return true
    if (codeQ && c.codeNorm.includes(codeQ)) return true
    if (textQ && c.titleLower.includes(textQ)) return true
    // all words of the query appear somewhere in the title
    return tokens.length > 0 && tokens.every((t) => c.titleLower.includes(t))
  })
}

/** Prefix buckets with per-term course counts, for the department grid. */
export function prefixCounts(term: string, commonCore = false): { code: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const c of courseList) {
    if (term && !c.tm.includes(term)) continue
    if (commonCore && c.cc.length === 0) continue
    counts.set(c.p, (counts.get(c.p) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

/** Aggregate numbers for the header/subtitle. */
export function termStats(term: string) {
  let total = 0
  let withPrereq = 0
  let commonCore = 0
  for (const c of courseList) {
    if (term && !c.tm.includes(term)) continue
    total += 1
    if (c.pr) withPrereq += 1
    if (c.cc.length) commonCore += 1
  }
  return { total, withPrereq, commonCore }
}

export const getTerms = () => meta.terms
export const getDepartmentName = (prefix: string) => meta.prefixToDept[prefix] ?? prefix
