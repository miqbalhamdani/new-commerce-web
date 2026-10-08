import type { BulkResult, Variant } from "@/lib/api/types"

export type BulkAction =
  | { kind: "status"; status: "active" | "draft" }
  | {
      kind: "price"
      direction: "up" | "down"
      unit: "amount" | "percent"
      value: number
    }

export interface BulkPlan {
  items: Record<string, unknown>[]
  /** The product each item belongs to, by item index. */
  owners: string[]
  /** Products that cannot take part, with why. */
  skipped: Map<string, string>
}

/**
 * Turns a list selection into POST /products/bulk items (P1-076). Bulk is
 * keyed on SKU (BR-043), so a status goes through one of the product's
 * SKU'd variants, and a price change through each of them; a product with no
 * SKU'd variant is reported rather than silently left out.
 */
export function planBulk(
  products: string[],
  variants: Map<string, Variant[]>,
  action: BulkAction,
): BulkPlan {
  const plan: BulkPlan = { items: [], owners: [], skipped: new Map() }
  for (const id of products) {
    const withSku = (variants.get(id) ?? []).filter(
      (v) => v.sku && !v.archived_at,
    )
    if (withSku.length === 0) {
      plan.skipped.set(id, "No variant has a SKU, which bulk changes go by.")
      continue
    }
    if (action.kind === "status") {
      plan.items.push({ sku: withSku[0].sku, status: action.status })
      plan.owners.push(id)
      continue
    }
    for (const v of withSku) {
      const sign = action.direction === "up" ? 1 : -1
      const delta =
        action.unit === "amount"
          ? action.value * 100
          : (v.regular_price * action.value) / 100
      plan.items.push({
        sku: v.sku,
        regular_price: Math.max(
          0,
          Math.round((v.regular_price + sign * delta) / 100) * 100,
        ),
      })
      plan.owners.push(id)
    }
  }
  return plan
}

/** The first failure per product, from per-row results by index. */
export function failuresByProduct(
  plan: BulkPlan,
  result: BulkResult,
): Map<string, string> {
  const out = new Map(plan.skipped)
  for (const r of result.results) {
    const owner = plan.owners[r.index]
    if (r.status === "error" && owner && !out.has(owner))
      out.set(owner, r.detail ?? r.code ?? "Not applied")
  }
  return out
}
