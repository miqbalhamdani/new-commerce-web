import type { Variant } from "@/lib/api/types"
import { moneyInput, parseMoney } from "@/lib/format"

// The variant matrix (P1-046, 04-api-spec.md §7.3): option axes across the
// top, every combination down the side, SKU / regular price / sale price /
// weight per row. Cells hold what the person typed; the request is built
// from them only on save.

export interface Axis {
  name: string
  values: string[]
}

export const columns = [
  "sku",
  "regular_price",
  "sale_price",
  "weight_grams",
] as const
export type Column = (typeof columns)[number]
export type Row = Record<Column, string>

export const emptyRow: Row = {
  sku: "",
  regular_price: "",
  sale_price: "",
  weight_grams: "",
}

/** Every combination of the axes' values, in axis order: 2 colours × 5 sizes is 10 rows. */
export function combos(axes: Axis[]): string[][] {
  return axes.reduce<string[][]>(
    (acc, axis) =>
      acc.flatMap((prefix) => axis.values.map((v) => [...prefix, v])),
    [[]],
  )
}

export const key = (values: string[]) => values.join("\u001f")

/** The grid a product's live variants describe. */
export function gridOf(
  optionNames: string[],
  variants: Variant[],
): { axes: Axis[]; cells: Map<string, Row> } {
  const axes = optionNames.map((name, i) => ({
    name,
    values: [
      ...new Set(
        variants
          .map((v) => v.option_values[i])
          .filter((x): x is string => x !== undefined),
      ),
    ],
  }))
  const cells = new Map<string, Row>()
  for (const v of variants) {
    cells.set(key(v.option_values), {
      sku: v.sku ?? "",
      regular_price: moneyInput(v.regular_price),
      sale_price: moneyInput(v.sale_price),
      weight_grams: v.weight_grams ? String(v.weight_grams) : "",
    })
  }
  return { axes, cells }
}

/**
 * Paste from Excel: tab-separated cells, one line per row, written from the
 * focused cell rightwards and downwards. Cells past the grid's edge are
 * dropped.
 */
export function paste(
  rows: Row[],
  startRow: number,
  startCol: number,
  text: string,
): Row[] {
  const lines = text.replace(/\r/g, "").replace(/\n$/, "").split("\n")
  const out = rows.map((r) => ({ ...r }))
  lines.forEach((line, i) => {
    const row = out[startRow + i]
    if (!row) return
    line.split("\t").forEach((value, j) => {
      const col = columns[startCol + j]
      if (col) row[col] = value.trim()
    })
  })
  return out
}

/** Fill-down: copy one cell into every row below it. */
export function fillDown(rows: Row[], fromRow: number, col: Column): Row[] {
  return rows.map((r, i) =>
    i > fromRow ? { ...r, [col]: rows[fromRow][col] } : r,
  )
}

export type CellErrors = Map<number, string>

/**
 * The PUT body for the grid as it stands, or the rows whose input is not a
 * number. A blank SKU or sale price is null; a blank price or weight is
 * left as it is on the variant.
 */
export function toRequest(axes: Axis[], rows: Row[]) {
  const errors: CellErrors = new Map()
  const body = combos(axes).map((option_values, i) => {
    const r = rows[i] ?? emptyRow
    const row: Record<string, unknown> = {
      option_values,
      sku: r.sku.trim() || null,
    }
    if (r.regular_price.trim()) {
      const n = parseMoney(r.regular_price)
      if (n === null) errors.set(i, "Regular price is not an amount")
      else row.regular_price = n
    }
    if (r.sale_price.trim()) {
      const n = parseMoney(r.sale_price)
      if (n === null) errors.set(i, "Sale price is not an amount")
      else row.sale_price = n
    } else {
      row.sale_price = null
    }
    if (r.weight_grams.trim()) {
      const n = Number(r.weight_grams.replace(/[.,\s]/g, ""))
      if (!Number.isInteger(n) || n < 0) errors.set(i, "Weight is whole grams")
      else row.weight_grams = n
    }
    return row
  })
  return {
    body: {
      option_names: axes.map((a) => a.name),
      rows: body,
      archive_missing: true,
    },
    errors,
  }
}
