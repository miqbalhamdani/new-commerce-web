import { describe, expect, it } from "vitest"

import { applyAdjustment, previewAdjustment } from "./adjust"
import { emptyRow, type Row } from "./matrix"

const rows: Row[] = [
  { ...emptyRow, regular_price: "199000" },
  { ...emptyRow, regular_price: "199000", sale_price: "149000" },
  { ...emptyRow },
]

describe("bulk price adjustment (P1-047)", () => {
  it("previews a percentage off the sale price, starting from regular where there is none", () => {
    const lines = previewAdjustment(rows, [0, 1, 2], {
      target: "sale_price",
      direction: "down",
      unit: "percent",
      value: 20,
    })
    expect(lines).toEqual([
      { row: 0, before: null, after: 15920000 },
      { row: 1, before: 14900000, after: 11920000 },
    ])
  })
  it("raises the regular price by an amount, only on the chosen rows", () => {
    const lines = previewAdjustment(rows, [1], {
      target: "regular_price",
      direction: "up",
      unit: "amount",
      value: 10000,
    })
    expect(lines).toEqual([{ row: 1, before: 19900000, after: 20900000 }])
    expect(applyAdjustment(rows, lines, "regular_price")[1].regular_price).toBe(
      "209,000",
    )
    expect(applyAdjustment(rows, lines, "regular_price")[0].regular_price).toBe(
      "199000",
    )
  })
  it("never goes below zero", () => {
    const [line] = previewAdjustment(rows, [0], {
      target: "regular_price",
      direction: "down",
      unit: "amount",
      value: 999999,
    })
    expect(line.after).toBe(0)
  })
})
