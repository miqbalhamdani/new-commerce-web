"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { BulkResult, Variant } from "@/lib/api/types"
import { asApiError, useApi } from "@/lib/api/use-api"
import {
  failuresByProduct,
  planBulk,
  type BulkAction,
} from "@/lib/catalog/bulk"

/**
 * Bulk actions on the product list (P1-076): status or price for the selected
 * products through POST /products/bulk. Rows that fail are reported back per
 * product, inline; the rest stay applied (BR-043).
 */
export function BulkActions({
  selected,
  onDone,
}: {
  selected: string[]
  onDone: (failures: Map<string, string>) => void
}) {
  const api = useApi()
  const [pricing, setPricing] = useState(false)
  const [price, setPrice] = useState<Extract<BulkAction, { kind: "price" }>>({
    kind: "price",
    direction: "down",
    unit: "percent",
    value: 10,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  async function run(action: BulkAction) {
    setBusy(true)
    try {
      const lists = await Promise.all(
        selected.map((id) =>
          api<{ data: Variant[] }>(`/v1/products/${id}/variants`).then(
            (r) => [id, r.data] as const,
          ),
        ),
      )
      const plan = planBulk(selected, new Map(lists), action)
      const results: BulkResult = {
        created: 0,
        updated: 0,
        failed: 0,
        results: [],
      }
      for (let i = 0; i < plan.items.length; i += 500) {
        const r = await api<BulkResult>("/v1/products/bulk", {
          method: "POST",
          body: { on_conflict: "update", items: plan.items.slice(i, i + 500) },
        })
        results.results.push(
          ...r.results.map((x) => ({ ...x, index: x.index + i })),
        )
      }
      setError(null)
      setPricing(false)
      onDone(failuresByProduct(plan, results))
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 text-theme-sm dark:border-gray-800 dark:bg-white/[0.03]"
      role="toolbar"
      aria-label="Bulk actions"
    >
      <span className="px-1 text-gray-600 dark:text-gray-400">
        {selected.length} selected
      </span>
      <Button
        size="sm"
        variant="outline"
        isLoading={busy}
        onClick={() => run({ kind: "status", status: "active" })}
      >
        Publish
      </Button>
      <Button
        size="sm"
        variant="outline"
        isLoading={busy}
        onClick={() => run({ kind: "status", status: "draft" })}
      >
        Unpublish
      </Button>
      <Button size="sm" variant="outline" onClick={() => setPricing(true)}>
        Adjust price
      </Button>
      <ErrorNotice error={error} title="Bulk change failed" />
      <Dialog
        open={pricing}
        onOpenChange={setPricing}
        title="Adjust regular price"
        description={`Every variant with a SKU in the ${selected.length} selected products.`}
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setPricing(false)}>
              Cancel
            </Button>
            <Button size="sm" isLoading={busy} onClick={() => run(price)}>
              Apply
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Direction"
            value={price.direction}
            onChange={(v) =>
              setPrice({ ...price, direction: v as "up" | "down" })
            }
            options={[
              { value: "down", label: "Lower by" },
              { value: "up", label: "Raise by" },
            ]}
          />
          <Input
            aria-label="Amount"
            className="w-28"
            inputMode="numeric"
            value={String(price.value)}
            onChange={(e) =>
              setPrice({
                ...price,
                value: Number(e.target.value.replace(/[^\d.]/g, "")) || 0,
              })
            }
          />
          <Select
            aria-label="Unit"
            value={price.unit}
            onChange={(v) =>
              setPrice({ ...price, unit: v as "amount" | "percent" })
            }
            options={[
              { value: "percent", label: "%" },
              { value: "amount", label: "Rp" },
            ]}
          />
        </div>
      </Dialog>
    </div>
  )
}
