import { moneyInput, parseMoney } from "@/lib/format"

import type { Row } from "./matrix"

export type Target = "regular_price" | "sale_price"

export interface Adjustment {
  target: Target
  direction: "up" | "down"
  unit: "amount" | "percent"
  value: number // rupiah for amount, percent for percent
}

export interface PreviewLine {
  row: number
  before: number | null // minor units
  after: number
}

/**
 * Bulk price adjustment (P1-047, BR-046): each chosen row's regular or sale
 * price moved by an amount or a percentage, rounded to whole rupiah and never
 * below zero. A sale price is adjusted from the regular price where a row has
 * none -- "20% off" is the usual reason to reach for this. Rows with nothing
 * to start from are left out of the preview.
 */
export function previewAdjustment(
  rows: Row[],
  indices: number[],
  a: Adjustment,
): PreviewLine[] {
  const lines: PreviewLine[] = []
  for (const i of indices) {
    const row = rows[i]
    if (!row) continue
    const current = parseMoney(row[a.target])
    const base =
      current ??
      (a.target === "sale_price" ? parseMoney(row.regular_price) : null)
    if (base === null) continue
    const sign = a.direction === "up" ? 1 : -1
    const delta = a.unit === "amount" ? a.value * 100 : (base * a.value) / 100
    const after = Math.max(0, Math.round((base + sign * delta) / 100) * 100)
    lines.push({ row: i, before: current, after })
  }
  return lines
}

export function applyAdjustment(
  rows: Row[],
  lines: PreviewLine[],
  target: Target,
): Row[] {
  const out = rows.map((r) => ({ ...r }))
  for (const l of lines) out[l.row][target] = moneyInput(l.after)
  return out
}
