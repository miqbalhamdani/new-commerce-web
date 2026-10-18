import { describe, expect, it } from "vitest"

import { change, periodRange } from "./period"

describe("dashboard periods (P1-114)", () => {
  it("ends tomorrow in WIB, today included", () => {
    // 18 Oct 2026, 08:00 WIB.
    expect(periodRange(7, new Date("2026-10-18T01:00:00Z"))).toEqual({
      from: "2026-10-12",
      to: "2026-10-19",
    })
    expect(periodRange(30, new Date("2026-10-18T01:00:00Z")).from).toBe(
      "2026-09-19",
    )
  })

  it("takes the WIB day, not the UTC one, around midnight", () => {
    // 23:30 UTC on the 17th is already 06:30 on the 18th in Jakarta.
    expect(periodRange(1, new Date("2026-10-17T23:30:00Z"))).toEqual({
      from: "2026-10-18",
      to: "2026-10-19",
    })
  })

  it("crosses month and year ends", () => {
    expect(periodRange(7, new Date("2027-01-02T05:00:00Z"))).toEqual({
      from: "2026-12-27",
      to: "2027-01-03",
    })
  })

  it("compares with the period before as a whole percent", () => {
    expect(change(120, 100)).toBe(20)
    expect(change(50, 100)).toBe(-50)
    expect(change(100, 300)).toBe(-67)
    expect(change(5, 0)).toBeNull()
    expect(change(0, 0)).toBeNull()
  })
})
