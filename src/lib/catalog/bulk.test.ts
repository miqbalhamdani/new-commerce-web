import { describe, expect, it } from "vitest"

import type { BulkResult, Variant } from "@/lib/api/types"

import { failuresByProduct, planBulk } from "./bulk"

const v = (id: string, sku: string | null, price = 20000000) =>
  ({ id, sku, regular_price: price, archived_at: null }) as unknown as Variant
const variants = new Map([
  ["p1", [v("a", "A-1"), v("b", "A-2")]],
  ["p2", [v("c", null)]],
])

describe("planBulk (P1-076)", () => {
  it("sends a status through one SKU per product and reports products without one", () => {
    const plan = planBulk(["p1", "p2"], variants, {
      kind: "status",
      status: "active",
    })
    expect(plan.items).toEqual([{ sku: "A-1", status: "active" }])
    expect(plan.owners).toEqual(["p1"])
    expect(plan.skipped.get("p2")).toMatch(/SKU/)
  })
  it("adjusts every SKU'd variant's price", () => {
    const plan = planBulk(["p1"], variants, {
      kind: "price",
      direction: "down",
      unit: "percent",
      value: 10,
    })
    expect(plan.items).toEqual([
      { sku: "A-1", regular_price: 18000000 },
      { sku: "A-2", regular_price: 18000000 },
    ])
  })
  it("maps per-row failures back to products; successes are not failures", () => {
    const plan = planBulk(["p1", "p2"], variants, {
      kind: "status",
      status: "active",
    })
    const result = {
      created: 0,
      updated: 0,
      failed: 1,
      results: [
        {
          index: 0,
          sku: "A-1",
          status: "error",
          variant_id: null,
          code: "publish_check_failed",
          detail: "The product cannot be published yet.",
        },
      ],
    } as BulkResult
    expect(failuresByProduct(plan, result)).toEqual(
      new Map([
        ["p2", "No variant has a SKU, which bulk changes go by."],
        ["p1", "The product cannot be published yet."],
      ]),
    )
  })
})
