import { describe, expect, it } from "vitest"

import { emptyFilters, filtersFromQuery, filtersToQuery } from "./filters"

describe("product list filters", () => {
  it("round-trips through the URL", () => {
    const f = {
      ...emptyFilters,
      q: "tee",
      status: "active" as const,
      sort: "title" as const,
    }
    expect(filtersFromQuery(filtersToQuery(f))).toEqual(f)
  })
  it("keeps the URL clean when nothing is set", () => {
    expect(filtersToQuery(emptyFilters).toString()).toBe("")
  })
  it("ignores values the API would refuse", () => {
    expect(
      filtersFromQuery(new URLSearchParams("status=gone&sort=price")),
    ).toEqual(emptyFilters)
  })
})
