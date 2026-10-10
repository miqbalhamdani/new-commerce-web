import { describe, expect, it } from "vitest"

import {
  activeView,
  emptyFilters,
  filtersFromQuery,
  filtersToQuery,
} from "@/lib/orders/filters"

describe("order filters", () => {
  it("round-trips, with status repeated to OR values", () => {
    const f = {
      q: "rina",
      status: ["paid", "processing"] as const,
      refund_owed: false,
      sort: "placed_at" as const,
    }
    const q = filtersToQuery({ ...f, status: [...f.status] })
    expect(q.toString()).toBe(
      "q=rina&status=paid&status=processing&sort=placed_at",
    )
    expect(filtersFromQuery(q)).toEqual(f)
  })

  it("defaults have a clean URL", () => {
    expect(filtersToQuery(emptyFilters).toString()).toBe("")
    expect(filtersFromQuery(new URLSearchParams())).toEqual(emptyFilters)
  })

  it("drops a status the contract does not know", () => {
    const f = filtersFromQuery(new URLSearchParams("status=paid&status=nope"))
    expect(f.status).toEqual(["paid"])
  })

  it("matches the saved views on status and refund_owed only", () => {
    expect(activeView({ ...emptyFilters, status: ["pending"] })).toBe("confirm")
    expect(
      activeView({ ...emptyFilters, q: "rina", status: ["processing", "paid"] }),
    ).toBe("ship")
    expect(activeView({ ...emptyFilters, refund_owed: true })).toBe("refund")
    expect(activeView({ ...emptyFilters, status: ["paid"] })).toBeNull()
    expect(activeView(emptyFilters)).toBeNull()
  })
})
