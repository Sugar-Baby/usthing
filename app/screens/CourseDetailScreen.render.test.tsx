/**
 * Rendering checks for the course detail screen over a 30-course sample.
 *
 * The intended design (and the thing these tests pin down) is:
 *   - a prerequisite is shown as a tree whenever it parses into course
 *     codes, and the raw published text is hidden in that case;
 *   - the raw text is shown when the tree cannot express everything —
 *     no course codes at all (exam scores, standing) or mixed conditions;
 *   - the same rule applies to co-requisites;
 *   - every page renders without crashing, whatever the data.
 *
 * The sample is deterministic: every 137th course of the 4,030, i.e. 30
 * courses spread across the whole catalogue.
 */
import { render } from "@testing-library/react-native"

import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { courseList, resolveDetail } from "@/services/courses"
import { ThemeProvider } from "@/theme/context"

import { CourseDetailScreen } from "./CourseDetailScreen"

const SAMPLE = courseList.filter((_, i) => i % 137 === 0).slice(0, 30)
const TERM = "2610"

type Props = AppStackScreenProps<"CourseDetail">

const renderDetail = (code: string) =>
  render(
    <ThemeProvider>
      <CourseDetailScreen
        route={{ key: `k-${code}`, name: "CourseDetail", params: { code, term: TERM } } as Props["route"]}
        navigation={{ goBack: jest.fn(), push: jest.fn() } as unknown as Props["navigation"]}
      />
    </ThemeProvider>,
  )

describe("CourseDetailScreen — 30-course sample", () => {
  it("samples 30 courses across the catalogue", () => {
    expect(SAMPLE).toHaveLength(30)
    const prefixes = new Set(SAMPLE.map((c) => c.p))
    expect(prefixes.size).toBeGreaterThan(10)
  })

  it("renders every sampled course without crashing", () => {
    for (const course of SAMPLE) {
      expect(() => renderDetail(course.c)).not.toThrow()
    }
  })

  it("follows the raw-vs-tree rule on every sampled course", () => {
    for (const course of SAMPLE) {
      const detail = resolveDetail(course.c, TERM)
      if (!detail?.pq) continue
      const hasTree = !!detail.pqd?.length
      const shouldShowRaw = !hasTree || detail.pqx === 1

      const view = renderDetail(course.c)
      const rawHits = view.queryAllByText(detail.pq)
      if (shouldShowRaw) {
        expect(rawHits.length).toBeGreaterThan(0)
      } else {
        expect(rawHits.length).toBe(0)
      }
    }
  })

  it("shows a tree and hides the raw text for pure course logic", () => {
    // COMP2011: "COMP 1023 OR COMP 1028"
    const detail = resolveDetail("COMP2011", TERM)
    expect(detail?.pqd?.length).toBeGreaterThan(0)
    expect(detail?.pqx).toBeUndefined()

    const view = renderDetail("COMP2011")
    expect(view.queryAllByText("COMP1023").length).toBeGreaterThan(0)
    expect(view.queryAllByText(detail!.pq!).length).toBe(0)
  })

  it("shows the raw text when the requirement is not course-based", () => {
    // LANG1117: "Level 4 or above in HKDSE Chinese"
    const detail = resolveDetail("LANG1117", TERM)
    expect(detail?.pqd ?? []).toHaveLength(0)

    const view = renderDetail("LANG1117")
    expect(view.queryAllByText(detail!.pq!).length).toBeGreaterThan(0)
  })

  it("shows both when the condition mixes courses with other clauses", () => {
    // ACCT2200: "(for non-BIBU students) ACCT 2010"
    const detail = resolveDetail("ACCT2200", TERM)
    expect(detail?.pqx).toBe(1)

    const view = renderDetail("ACCT2200")
    expect(view.queryAllByText(detail!.pq!).length).toBeGreaterThan(0)
    expect(view.queryAllByText("ACCT2010").length).toBeGreaterThan(0)
  })

  it("renders co-requisites as a tree when they parse", () => {
    // COMP2711's co-requisite lists six alternative maths courses
    const detail = resolveDetail("COMP2711", TERM)
    expect(detail?.cqd?.length).toBeGreaterThan(0)

    const view = renderDetail("COMP2711")
    expect(view.queryAllByText("MATH1013").length).toBeGreaterThan(0)
  })

  it("makes the AND/OR structure explicit in the tree", () => {
    // AIAA2711: (UFUG 1103 OR UFUG 1106) AND (UFUG 2102 OR UFUG 2103)
    // parses into four options, each an "all of" pair.
    const view = renderDetail("AIAA2711")
    expect(view.queryAllByText("Any one of these 4 options:").length).toBeGreaterThan(0)
    expect(view.queryAllByText("Option 1 · all of").length).toBeGreaterThan(0)
    expect(view.queryAllByText("Option 4 · all of").length).toBeGreaterThan(0)
    expect(view.queryAllByText("or").length).toBeGreaterThan(0)
    expect(view.queryAllByText("and").length).toBeGreaterThan(0)
  })

  it("labels a single AND group as 'All of the following'", () => {
    const single = courseList.find((c) => {
      const d = resolveDetail(c.c, TERM)?.pqd
      return Array.isArray(d) && d.length === 1 && Array.isArray(d[0]) && d[0].length > 1
    })
    expect(single).toBeTruthy()
    const view = renderDetail(single!.c)
    expect(view.queryAllByText("All of the following:").length).toBeGreaterThan(0)
    expect(view.queryAllByText("and").length).toBeGreaterThan(0)
    expect(view.queryAllByText("or").length).toBe(0)
  })

  it("renders a lone prerequisite without any AND/OR chrome", () => {
    const solo = courseList.find((c) => {
      const d = resolveDetail(c.c, TERM)?.pqd
      return Array.isArray(d) && d.length === 1 && typeof d[0] === "string"
    })
    if (solo) {
      const view = renderDetail(solo.c)
      expect(view.queryAllByText("All of the following:").length).toBe(0)
      expect(view.queryAllByText("or").length).toBe(0)
    }
  })

  it("handles courses with no prerequisites at all", () => {
    const plain = SAMPLE.find((c) => !resolveDetail(c.c, TERM)?.pq)
    if (plain) {
      const view = renderDetail(plain.c)
      expect(view.queryAllByText("No prerequisites.").length).toBeGreaterThan(0)
    }
  })
})
