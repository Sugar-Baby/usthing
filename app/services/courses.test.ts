/**
 * Data-layer tests over the real preprocessed dataset.
 *
 * These pin the guarantees the UI relies on: the shape of the catalog,
 * search semantics (normalised codes, tokenised titles), per-term variants,
 * DNF integrity for prerequisites, and the reverse "unlocks" graph.
 */
import {
  catalog,
  courseList,
  extractCodes,
  flattenDnf,
  getTerms,
  getUnlocks,
  isDnfSatisfied,
  normalizeCode,
  prefixCounts,
  queryCourses,
  resolveCourse,
  resolveDetail,
} from "./courses"

describe("catalog", () => {
  it("ships the full preprocessed dataset", () => {
    expect(courseList.length).toBe(4030)
    expect(getTerms().map((t) => t.code)).toEqual(["2610", "2540", "2530", "2520"])
  })

  it("is sorted by course code and every record has a title", () => {
    const codes = courseList.slice(0, 200).map((c) => c.c)
    expect([...codes].sort()).toEqual(codes)
    expect(courseList.every((c) => c.t.length > 0)).toBe(true)
  })
})

describe("search", () => {
  it("normalises course codes", () => {
    expect(normalizeCode("comp 2011")).toBe("COMP2011")
    expect(normalizeCode("comp-2011")).toBe("COMP2011")
  })

  it("matches codes with or without spaces", () => {
    expect(queryCourses({ term: "2610", text: "comp2011" }).map((c) => c.c)).toContain("COMP2011")
    expect(queryCourses({ term: "2610", text: "comp 2011" }).map((c) => c.c)).toContain("COMP2011")
  })

  it("matches title words in any order", () => {
    const hits = queryCourses({ term: "2610", text: "introduction computing" })
    expect(hits.length).toBe(7)
    expect(hits.every((c) => c.t.toLowerCase().includes("introduction"))).toBe(true)
  })

  it("filters by prefix and term together", () => {
    const comp = queryCourses({ term: "2610", prefix: "COMP" })
    expect(comp.length).toBeGreaterThan(0)
    expect(comp.every((c) => c.p === "COMP" && c.tm.includes("2610"))).toBe(true)
  })

  it("filters to Common Core courses", () => {
    const cc = queryCourses({ term: "2610", commonCore: true })
    expect(cc.length).toBe(296)
    expect(cc.every((c) => c.cc.length > 0)).toBe(true)
  })

  it("returns everything for a term when there is no query", () => {
    expect(queryCourses({ term: "2610" }).length).toBe(3928)
  })
})

describe("term-aware resolution", () => {
  it("applies per-term overrides where the dataset differs", () => {
    const newest = resolveDetail("AIAA2711", "2610")
    const older = resolveDetail("AIAA2711", "2520")
    expect(newest?.pqd).not.toEqual(older?.pqd)
    expect(flattenDnf(older?.pqd).sort()).toEqual(["UFUG1103", "UFUG1106"])
  })

  it("falls back to the base record when a term has no override", () => {
    expect(resolveCourse("COMP2011", "2520")?.t).toBe(resolveCourse("COMP2011", "2610")?.t)
  })

  it("carries the term list of every offering", () => {
    expect(resolveCourse("COMP2011", "2610")?.tm).toEqual(["2610", "2540", "2530", "2520"])
  })
})

describe("prerequisite DNF", () => {
  it("parses AND/OR into DNF over course codes", () => {
    expect(resolveDetail("AIAA2711", "2610")?.pqd).toEqual([
      ["UFUG1103", "UFUG2102"],
      ["UFUG1103", "UFUG2103"],
      ["UFUG1106", "UFUG2102"],
      ["UFUG1106", "UFUG2103"],
    ])
  })

  it("handles courses with no prerequisites", () => {
    expect(resolveDetail("COMP1021", "2610")?.pq).toBeUndefined()
  })

  it("keeps raw text when the requirement is not course-based", () => {
    const d = resolveDetail("LANG1117", "2610")
    expect(d?.pq).toMatch(/HKDSE/)
    expect(d?.pqd).toEqual([])
    expect(d?.pqx).toBe(1)
  })

  it("flags partial parses that mix codes with other conditions", () => {
    expect(resolveDetail("COMP2711", "2610")?.pqx).toBe(1)
  })
})

describe("reverse graph", () => {
  it("lists the courses that require this one", () => {
    const unlocks = getUnlocks("COMP1021")
    expect(unlocks.length).toBeGreaterThan(10)
    expect(unlocks).toContain("CENG4160")
    expect(unlocks.every((code) => !!catalog[code])).toBe(true)
  })

  it("returns an empty list for courses nothing depends on", () => {
    expect(getUnlocks("NOPE9999")).toEqual([])
  })
})

describe("helpers", () => {
  it("extracts course codes from free text", () => {
    expect(extractCodes("ACCT 2010, CORE 1310")).toEqual(["ACCT2010", "CORE1310"])
    expect(extractCodes(undefined)).toEqual([])
  })

  it("counts courses per prefix for a term", () => {
    const counts = prefixCounts("2610")
    expect(counts.length).toBe(129)
    expect(counts.reduce((sum, c) => sum + c.count, 0)).toBe(3928)
  })

  it("flattens a DNF to its codes", () => {
    expect(flattenDnf([["A1000", "B2000"], "C3000"]).sort()).toEqual(["A1000", "B2000", "C3000"])
    expect(flattenDnf(undefined)).toEqual([])
  })
})

describe("fuzzy search", () => {
  it("ranks an exact code match first", () => {
    expect(queryCourses({ term: "2610", text: "COMP2011" })[0]?.c).toBe("COMP2011")
  })

  it("tolerates a one-character typo in a code", () => {
    const hits = queryCourses({ term: "2610", text: "COMP2001" }).map((c) => c.c)
    expect(hits).toContain("COMP2011")
    expect(hits).toContain("COMP1001")
  })

  it("returns nothing for unrelated queries", () => {
    expect(queryCourses({ term: "2610", text: "zzzz9998" })).toEqual([])
  })
})

describe("prerequisite satisfaction", () => {
  it("is satisfied by any single complete AND-group", () => {
    const dnf = [["A1000", "B2000"], ["C3000"]]
    expect(isDnfSatisfied(dnf, new Set(["A1000", "B2000"]))).toBe(true)
    expect(isDnfSatisfied(dnf, new Set(["C3000"]))).toBe(true)
    expect(isDnfSatisfied(dnf, new Set(["A1000"]))).toBe(false)
  })

  it("treats an empty requirement as satisfied", () => {
    expect(isDnfSatisfied([], new Set())).toBe(true)
    expect(isDnfSatisfied(undefined, new Set())).toBe(true)
  })

  it("evaluates a real course's OR-of-ANDs prerequisite", () => {
    const dnf = resolveDetail("AIAA2711", "2610")?.pqd
    expect(isDnfSatisfied(dnf, new Set(["UFUG1103", "UFUG2102"]))).toBe(true)
    expect(isDnfSatisfied(dnf, new Set(["UFUG1103"]))).toBe(false)
  })
})
