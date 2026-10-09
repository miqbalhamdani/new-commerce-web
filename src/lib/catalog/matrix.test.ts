import { describe, expect, it } from "vitest"

import type { Variant } from "@/lib/api/types"

import {
  combos,
  emptyRow,
  fillDown,
  gridOf,
  key,
  paste,
  toRequest,
  type Axis,
  type Row,
} from "./matrix"

const axes: Axis[] = [
  { name: "Colour", values: ["Black", "White"] },
  { name: "Size", values: ["S", "M", "L", "XL", "XXL"] },
]
const rows = (): Row[] => combos(axes).map(() => ({ ...emptyRow }))

describe("matrix", () => {
  it("a 2×5 grid is 10 rows in axis order", () => {
    const c = combos(axes)
    expect(c).toHaveLength(10)
    expect(c[0]).toEqual(["Black", "S"])
    expect(c[9]).toEqual(["White", "XXL"])
    expect(combos([])).toEqual([[]])
  })

  it("pastes an Excel block from the focused cell", () => {
    const out = paste(
      rows(),
      1,
      0,
      "TS-1\t199.000\t\t200\r\nTS-2\t199000\t149000\t210\n",
    )
    expect(out[1]).toEqual({
      sku: "TS-1",
      regular_price: "199.000",
      sale_price: "",
      weight_grams: "200",
    })
    expect(out[2]).toEqual({
      sku: "TS-2",
      regular_price: "199000",
      sale_price: "149000",
      weight_grams: "210",
    })
    expect(out[0]).toEqual(emptyRow)
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

  it("builds one request for the whole grid", () => {
    const r = rows()
    r[0] = {
      sku: "TS-BLK-S",
      regular_price: "199.000",
      sale_price: "",
      weight_grams: "200",
    }
    r[1] = { sku: "", regular_price: "abc", sale_price: "", weight_grams: "" }
    const { body, errors } = toRequest(axes, r)
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

  it("a combination with no live variant starts removed, and is not sent", () => {
    const v = (values: string[]) =>
      ({
        id: values.join(),
        option_values: values,
        sku: null,
        regular_price: 100,
        sale_price: null,
        weight_grams: 0,
      }) as unknown as Variant
    const g = gridOf(
      ["Colour", "Size"],
      [v(["Red", "S"]), v(["Red", "XL"]), v(["Blue", "S"])],
    )
    expect([...g.removed]).toEqual([key(["Blue", "XL"])])
    const { body } = toRequest(
      g.axes,
      [emptyRow, emptyRow, emptyRow],
      g.removed,
    )
    expect(
      body.rows.map((r) => (r as { option_values: string[] }).option_values),
    ).toEqual([
      ["Red", "S"],
      ["Red", "XL"],
      ["Blue", "S"],
    ])
  })
})
