import { describe, expect, it } from "vitest"

import type { Variant } from "@/lib/api/types"

import {
  emptyRow,
  fillDown,
  paste,
  rowsOf,
  toRequest,
  type VariantRow,
} from "./matrix"

const names = ["Colour", "Size"]
const rows = (): VariantRow[] =>
  ["Black", "White"].flatMap((c) =>
    ["S", "M", "L", "XL", "XXL"].map((s) => ({ ...emptyRow, values: [c, s] })),
  )

describe("matrix", () => {
  it("one row per live variant, values in option order", () => {
    const out = rowsOf([
      {
        id: "v1",
        option_values: ["Black", "S"],
        sku: null,
        regular_price: 19900000,
        sale_price: null,
        weight_grams: 0,
      } as unknown as Variant,
    ])
    expect(out).toEqual([
      {
        id: "v1",
        values: ["Black", "S"],
        sku: "",
        regular_price: "199000",
        sale_price: "",
        weight_grams: "",
      },
    ])
  })

  it("pastes an Excel block from the focused cell", () => {
    const out = paste(
      rows(),
      1,
      0,
      "TS-1\t199.000\t\t200\r\nTS-2\t199000\t149000\t210\n",
    )
    expect(out[1]).toEqual({
      values: ["Black", "M"],
      sku: "TS-1",
      regular_price: "199.000",
      sale_price: "",
      weight_grams: "200",
    })
    expect(out[2]).toEqual({
      values: ["Black", "L"],
      sku: "TS-2",
      regular_price: "199000",
      sale_price: "149000",
      weight_grams: "210",
    })
    expect(out[0]).toEqual({ ...emptyRow, values: ["Black", "S"] })
  })

  it("drops what falls past the grid", () => {
    const out = paste(rows(), 9, 3, "1\t2\n3")
    expect(out[9].weight_grams).toBe("1")
  })

  it("fills a column down", () => {
    const start = rows()
    start[2].regular_price = "199000"
    const out = fillDown(start, 2, "regular_price")
    expect(out.slice(3).every((r) => r.regular_price === "199000")).toBe(true)
    expect(out[1].regular_price).toBe("")
  })

  it("builds one request for every row", () => {
    const r = rows()
    r[0] = {
      values: [" Black ", "S"],
      sku: "TS-BLK-S",
      regular_price: "199.000",
      sale_price: "",
      weight_grams: "200",
    }
    r[1] = { ...r[1], regular_price: "abc" }
    const { body, errors } = toRequest(names, r)
    expect(body.rows).toHaveLength(10)
    expect(body.rows[0]).toEqual({
      option_values: ["Black", "S"],
      sku: "TS-BLK-S",
      regular_price: 19900000,
      sale_price: null,
      weight_grams: 200,
    })
    expect(errors.get(1)).toBe("Regular price is not an amount")
    expect(body.option_names).toEqual(["Colour", "Size"])
  })

  it("refuses a blank option and a repeat of an earlier row", () => {
    const r = rows().slice(0, 3)
    r[1] = { ...r[1], values: ["Black", " "] }
    r[2] = { ...r[2], values: ["Black", "S"] }
    const { errors } = toRequest(names, r)
    expect(errors.get(1)).toBe("Fill in Size")
    expect(errors.get(2)).toBe("Same options as variant 1")
    expect(errors.has(0)).toBe(false)
  })
})
