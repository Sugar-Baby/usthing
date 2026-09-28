# HKUST Course Explorer

A React Native (Expo) course explorer for the HKUST catalog, built for the
USThing App Team 2026-27 Fall technical test.

Everything runs **offline**: the supplied [`courses.json`](courses.json)
(28 MB, 15,178 term offerings) is preprocessed into indexed assets that ship
inside the app. There is no backend, no authentication and no live API.

## Quick start

```bash
npm install
npx expo start
```

Then scan the QR code with **Expo Go**, or press `i` / `a` in the terminal
for a simulator. To produce a web build: `npm run bundle:web`.

Requirements: Node.js ≥ 20, npm ≥ 10 (or yarn — a `yarn.lock` is included
from the template).

## Platforms tested

| Platform | Status |
|---|---|
| Android (Expo Go / emulator) | primary target |
| iOS (Expo Go / simulator) | same code paths, `ScrollView`/`FlatList` only |
| Web (`expo start --web`) | works; layout is phone-first |

## What's implemented

**Required**

- Browse courses and basic information (code, title, credits, level,
  description, CILOs, catalog attributes).
- Filter by **department** (prefix grid + per-department list) and by
  **term** (four-term picker; see “Terms as data versions” below).
- Search by **course code** (`comp2011`, `comp 2011`) and **title words**.
- Course detail view with description, attributes, prerequisites,
  co-requisites, exclusions, and the courses this course unlocks.
- Recursive prerequisite exploration: DNF tree, tap to expand deeper
  levels, tap a code to navigate, cycles and repeated courses terminate.
- Courses with no prerequisites are handled explicitly; prerequisite text
  containing non-course conditions (HKDSE / IELTS / GaoKao / standing) is
  shown verbatim with a note that only the course-based part is drawn.
- Everything works without any API.

**Optional extras taken**

- Reverse index — “this course unlocks N courses” with navigation.
- Common Core shortcut using the dataset’s own `CC22/CC25/CC26/4Y`
  attribute labels.
- Term-aware data: requirements are shown exactly as they stood in the
  selected term.
- Dark mode (the template’s theme system, re-palettised to HKUST colours).

## Architecture

```
app/
  app.tsx                 entry: fonts, theme, i18n, navigation
  components/
    CourseCard.tsx        course list card (rouste-style)
    PrereqTree.tsx        recursive DNF prerequisite tree
    Text.tsx …            template UI kit (kept)
  data/                   GENERATED — do not edit; see scripts/preprocess.py
    catalog.json          4,030 slim course records
    graph.json            reverse prerequisite edges
    details/<PFX>.json    129 lazy detail shards
    details/index.ts      static require() map for the shards
    meta.json             departments, terms, parser stats
  navigators/             react-navigation native stack (3 screens)
  screens/
    CoursesScreen.tsx     home: term picker, search, department grid
    CourseListScreen.tsx  one department / Common Core / all courses
    CourseDetailScreen.tsx detail + prerequisite tree
  services/courses.ts     the data access layer (single source of truth)
  theme/                  HKUST palette (light + dark)
scripts/preprocess.py     dataset pipeline (Python 3, stdlib only)
```

**State management.** Deliberately minimal: plain React state. The dataset
is immutable and loaded once at module scope in `app/services/courses.ts`;
screens hold only UI state (`term`, search text, expanded nodes). No global
store is warranted for a read-only catalog, and this keeps the data layer
testable and dependency-free.

**Navigation.** `react-navigation` native stack with three routes.
`Courses` → `CourseList` → `CourseDetail`, with detail-to-detail pushes for
prerequisite hopping (back always retraces your exploration path).

## Data pipeline — the 28 MB problem

`scripts/preprocess.py` (stdlib-only Python; run with
`python scripts/preprocess.py`) turns the supplied dataset into ~4.6 MB of
app assets in under a second:

1. **Merge offerings into courses.** The dataset holds 15,178 *term
   offerings*; course identity is `(prefix, number)`, giving 4,030 unique
   courses. Fields are merged with the newest term winning.
2. **Terms as data versions.** ~315 courses differ between terms (117 carry
   different prerequisite text, 107 a different description, 94 different
   exclusions). Instead of discarding the older versions, per-term
   overrides are stored sparsely (`tv` in the catalog/detail records) and
   applied by `resolveCourse` / `resolveDetail` when the user switches
   term. Nothing is thrown away.
3. **Parse conditions into DNF.** `prerequisite` / `corequisite` text is
   parsed into disjunctive normal form over course codes with a
   recursive-descent parser (`AND`/`OR`/parentheses, `/` also read as OR —
   common in this catalog). Grade qualifiers and outdated “prior to
   YYYY-YY” clauses are stripped while keeping the course codes inside
   them; non-course conditions are detected (`pqx`) and the raw text is
   always kept for display. Prefix handling removes `(for non-BIBU
   students)`-style clauses. 96% of prerequisite strings parse into DNF;
   the remainder either contain no course codes at all (pure exam-score
   requirements) or are listed below as limitations.
4. **Build the reverse graph.** 2,175 “unlocks” edges: for every parsed
   prerequisite, the requiring course is recorded against the required
   one.
5. **Index and shard.** The list/search view needs only the 646 KB
   `catalog.json` (code, title, prefix, credits, level, terms, flags,
   Common Core labels). Details (descriptions, CILOs, DNF trees) are split
   into 129 per-prefix shards of ~35 KB, lazily `require()`d and cached per
   prefix — opening a course never parses the whole corpus.

Final asset sizes: `catalog.json` 646 KB, `graph.json` 30 KB,
129 detail shards ~3.9 MB total, `meta.json` 5 KB.

**Parser provenance.** The DNF parser is adapted from *rouste*, the
author's own earlier HKUST course planner, and extended for this catalog
(`/` as OR, this dataset's qualifier patterns).

## Search & filtering

`queryCourses()` filters the in-memory catalog on three axes — term,
prefix (department), Common Core — plus free text. Code matching is
normalised (`comp 2011` → `COMP2011`), title matching is token-based
(every word must appear), so “introduction computing” finds *Introduction
to Computing with Python*. Filtering 4,030 records is a single array pass
(< 2 ms) and results are memoised per (term, query).

## Prerequisite traversal

The tree renders the DNF directly: OR-groups are separated by “or”, courses
inside a group are AND-ed (joined with “+”). Each node resolves the
course's own DNF in the *selected term*; `path` carries the ancestor codes
so a cycle (`A → B → A`) or a repeated course renders a `↻` marker instead
of recursing forever. Courses referenced but absent from the dataset (224
such codes — retired or external courses) render as “not in catalog” and
remain navigable.

## Assumptions & limitations

- **Dataset scope.** UST Archive catalog data for four terms; no section,
  quota or enrolment data exists (per the brief update, none is shown).
- **Non-course requirements** (public-exam scores, GPA, standing,
  instructor approval) are shown as raw text, not evaluated. The DNF tree
  covers the course-based part only and says so where relevant.
- **105 of 4,030 courses** change prerequisites between terms; the app
  shows the selected term's version. When a course is opened for a term it
  did not run in, the app says so and falls back to the newest term.
- **41 prerequisite strings parse to no course codes** — they are pure
  exam-score/standing conditions (e.g. LANG placement). They display as
  text with an explanatory note.
- **224 referenced course codes are not in the dataset** (retired or
  cross-listed); they render as “not in catalog”.
- Descriptions/CILOs are shown for the newest term (term variants are
  stored for title, credits, description, prerequisites, co-requisites and
  exclusions).
- `courses.json` is included in the repository (~28 MB); the generated
  assets under `app/data/` are committed too, so the app runs without
  re-running the pipeline.

## Credits

- Dataset and starter template: USThing App Team
  (`USThing/AppTechTest2627Fall`).
- Prerequisite DNF parser adapted from the author's earlier project
  *rouste*; the department-menu and course-card visual language follows it
  as well.
