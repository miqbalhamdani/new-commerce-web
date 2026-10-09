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

/** The options that have values yet: only these make combinations or columns. */
export const live = (axes: Axis[]) => axes.filter((a) => a.values.length > 0)

/**
 * Every combination of the axes' values, in axis order: 2 colours × 5 sizes
 * is 10 rows. An option with no values yet is skipped, so adding one does
 * not empty the grid.
 */
export function combos(axes: Axis[]): string[][] {
  return live(axes).reduce<string[][]>(
    (acc, axis) =>
      acc.flatMap((prefix) => axis.values.map((v) => [...prefix, v])),
    [[]],
  )
}

export const key = (values: string[]) => values.join("\u001f")

/**
 * The grid a product's live variants describe. Combinations with no live
 * variant (Red / XL never sold, or archived) come back as removed, so they
 * are not shown as empty rows and created on save.
 */
export function gridOf(
  optionNames: string[],
  variants: Variant[],
): { axes: Axis[]; cells: Map<string, Row>; removed: Set<string> } {
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
  // A product with no variants yet has nothing removed: its rows are new.
  const removed = new Set(
    variants.length
      ? combos(axes)
          .map(key)
          .filter((k) => !cells.has(k))
      : [],
  )
  return { axes, cells, removed }
}

/**
 * What was typed, re-keyed after the options change so nothing typed is
 * lost. from[n] is the index in `before` that option n of `after` came from
 * (undefined for a new option); options match by position, so renaming one
 * changes nothing. Each new combination takes the row of the first old one
 * that agrees on every option both have values for, treating a value that is
 * new as agreeing with any: adding Size gives Red / S and Red / M the row
 * typed for Red, a new size L starts from Red / S, removing Size gives Red
 * the row of Red / S. A copied row leaves its SKU on the first copy only.
 * Removed rows stay removed.
 */
export function carry(
  before: Axis[],
  after: Axis[],
  from: (number | undefined)[],
  cells: Map<string, Row>,
  removed: Set<string>,
): { cells: Map<string, Row>; removed: Set<string> } {
  const oldLive = before.flatMap((a, i) => (a.values.length ? [i] : []))
  const newLive = after.flatMap((a, i) => (a.values.length ? [i] : []))
  // [position in an old combination, position in a new one, the old values]
  const shared = newLive.flatMap((n, pn) => {
    const o = from[n]
    const po = o === undefined ? -1 : oldLive.indexOf(o)
    return po >= 0 ? [[po, pn, before[o!].values] as const] : []
  })
  const old = combos(before)
  const next = { cells: new Map<string, Row>(), removed: new Set<string>() }
  const skuTaken = new Set<string>()
  for (const c of combos(after)) {
    const exact = shared.every(([, pn, values]) => values.includes(c[pn]))
    const matches = old.filter((o) =>
      shared.every(
        ([po, pn, values]) => o[po] === c[pn] || !values.includes(c[pn]),
      ),
    )
    const kept = matches.find((o) => cells.has(key(o)) && !removed.has(key(o)))
    if (kept) {
      // SKUs are unique (BR-041): only the first row to take one keeps it.
      const row = cells.get(key(kept))!
      next.cells.set(
        key(c),
        skuTaken.has(key(kept)) ? { ...row, sku: "" } : row,
      )
      skuTaken.add(key(kept))
    } else if (
      exact &&
      matches.length &&
      matches.every((o) => removed.has(key(o)))
    )
      next.removed.add(key(c))
  }
  return next
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

/** The grid's combinations less the ones removed: the rows on screen. */
export const visible = (axes: Axis[], removed: Set<string>) =>
  combos(axes).filter((c) => !removed.has(key(c)))

/**
 * The PUT body for the grid as it stands, or the rows whose input is not a
 * number. A blank SKU or sale price is null; a blank price or weight is
 * left as it is on the variant. Removed combinations are not sent, so
 * archive_missing archives them.
 */
export function toRequest(
  axes: Axis[],
  rows: Row[],
  removed: Set<string> = new Set(),
) {
  const errors: CellErrors = new Map()
  const body = visible(axes, removed).map((option_values, i) => {
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
      option_names: live(axes).map((a) => a.name),
      rows: body,
      archive_missing: true,
    },
    errors,
  }
}
