import type { Variant } from "@/lib/api/types"
import { moneyInput, parseMoney } from "@/lib/format"

// The variants editor (P1-046, 04-api-spec.md §7.3): option names once for
// the product, then one row per variant with a value for each option and its
// SKU / regular price / sale price / weight. Rows hold what the person typed;
// the request is built from them only on save.

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

/** A variant as typed: a value per option, then the price columns. */
export type VariantRow = Row & {
  values: string[]
  /** The live variant this row edits; a new row has none. */
  id?: string
}

/** One row per live variant, its values in option order (BR-040). */
export function rowsOf(variants: Variant[]): VariantRow[] {
  return variants.map((v) => ({
    id: v.id,
    values: [...v.option_values],
    sku: v.sku ?? "",
    regular_price: moneyInput(v.regular_price),
    sale_price: moneyInput(v.sale_price),
    weight_grams: v.weight_grams ? String(v.weight_grams) : "",
  }))
}

export const label = (values: string[]) =>
  values.filter(Boolean).join(" / ") || "the variant"

/**
 * Paste from Excel: tab-separated cells, one line per row, written from the
 * focused cell rightwards and downwards. Cells past the grid's edge are
 * dropped.
 */
export function paste<R extends Row>(
  rows: R[],
  startRow: number,
  startCol: number,
  text: string,
): R[] {
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
export function fillDown<R extends Row>(
  rows: R[],
  fromRow: number,
  col: Column,
): R[] {
  return rows.map((r, i) =>
    i > fromRow ? { ...r, [col]: rows[fromRow][col] } : r,
  )
}

export type CellErrors = Map<number, string>

/**
 * The PUT body for the rows as they stand, or the rows that cannot be sent:
 * an option left blank, the same options as an earlier row (BR-040), or an
 * input that is not a number. A blank SKU or sale price is null; a blank
 * price or weight is left as it is on the variant. Rows not sent are
 * archived (archive_missing).
 */
export function toRequest(names: string[], rows: VariantRow[]) {
  const errors: CellErrors = new Map()
  const seen = new Map<string, number>()
  const body = rows.map((r, i) => {
    const option_values = names.map((_, j) => (r.values[j] ?? "").trim())
    const blank = option_values.findIndex((v) => !v)
    const k = option_values.join("\u001f")
    if (blank >= 0) errors.set(i, `Fill in ${names[blank] || "the option"}`)
    else if (seen.has(k))
      errors.set(i, `Same options as variant ${seen.get(k)! + 1}`)
    else seen.set(k, i)
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
      option_names: names.map((n) => n.trim()),
      rows: body,
      archive_missing: true,
    },
    errors,
  }
}
