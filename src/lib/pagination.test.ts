import { describe, expect, it } from "vitest"

import { pageFromQuery, pageSpan, pageWindow, withPage } from "./pagination"

describe("numbered paging (P1-232)", () => {
  it("reads a positive integer page, else 1", () => {
    for (const [q, want] of [
      ["", 1],
      ["page=3", 3],
      ["page=0", 1],
      ["page=-2", 1],
      ["page=2.5", 1],
      ["page=abc", 1],
    ] as const) {
      expect(pageFromQuery(new URLSearchParams(q))).toBe(want)
    }
  })

  it("sets the page and keeps the filters, dropping it on page 1", () => {
    const q = new URLSearchParams("status=active&page=4")
    expect(withPage(q, 2)).toBe("status=active&page=2")
    expect(withPage(q, 1)).toBe("status=active")
  })

  it("spans the rows shown and counts the pages", () => {
    expect(pageSpan(1, 50, 128)).toEqual({ from: 1, to: 50, pages: 3 })
    expect(pageSpan(3, 50, 128)).toEqual({ from: 101, to: 128, pages: 3 })
    expect(pageSpan(1, 50, 0)).toEqual({ from: 0, to: 0, pages: 1 })
    expect(pageSpan(9, 50, 128)).toEqual({ from: 128, to: 128, pages: 3 })
  })

  it("windows the page buttons around the current page", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3])
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, "…", 10])
    expect(pageWindow(6, 12)).toEqual([1, "…", 4, 5, 6, 7, 8, "…", 12])
    expect(pageWindow(12, 12)).toEqual([1, "…", 10, 11, 12])
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
