"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Dialog } from "@/components/ui/common/Dialog"
import { Select } from "@/components/ui/common/Select"
import {
  applyAdjustment,
  previewAdjustment,
  type Adjustment,
} from "@/lib/catalog/adjust"
import type { Row } from "@/lib/catalog/matrix"
import { formatMoney } from "@/lib/format"

/**
 * Bulk price adjustment in the matrix (P1-047): on the selected rows, or all
 * of them, by an amount or a percentage, on the regular or the sale price as
 * the person chooses. A preview shows every change before it applies; the
 * grid still needs saving afterwards.
 */
export function BulkPriceAdjust({
  rows,
  setRows,
  selected,
  combos,
}: {
  rows: Row[]
  setRows: (r: Row[]) => void
  selected: Set<number>
  combos: string[][]
}) {
  const [open, setOpen] = useState(false)
  const [a, setA] = useState<Adjustment>({
    target: "regular_price",
    direction: "down",
    unit: "percent",
    value: 10,
  })
  const indices = selected.size
    ? [...selected].sort((x, y) => x - y)
    : rows.map((_, i) => i)
  const preview = previewAdjustment(rows, indices, a)

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="mb-3"
        onClick={() => setOpen(true)}
      >
        Adjust prices{selected.size ? ` (${selected.size} selected)` : ""}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Adjust prices"
        description={
          selected.size
            ? `${selected.size} selected variants.`
            : "Every variant in the grid."
        }
        footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={preview.length === 0}
              onClick={() => {
                setRows(applyAdjustment(rows, preview, a.target))
                setOpen(false)
              }}
            >
              Apply to {preview.length} variant{preview.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Price"
            value={a.target}
            onChange={(v) => setA({ ...a, target: v as Adjustment["target"] })}
            options={[
              { value: "regular_price", label: "Regular price" },
              { value: "sale_price", label: "Sale price" },
            ]}
          />
          <Select
            aria-label="Direction"
            value={a.direction}
            onChange={(v) =>
              setA({ ...a, direction: v as Adjustment["direction"] })
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
            value={String(a.value)}
            onChange={(e) =>
              setA({
                ...a,
                value: Number(e.target.value.replace(/[^\d.]/g, "")) || 0,
              })
            }
          />
          <Select
            aria-label="Unit"
            value={a.unit}
            onChange={(v) => setA({ ...a, unit: v as Adjustment["unit"] })}
            options={[
              { value: "percent", label: "%" },
              { value: "amount", label: "Rp" },
            ]}
          />
        </div>
        <div className="mt-4 max-h-64 overflow-auto">
          <table className="w-full text-sm" aria-label="Preview">
            <thead>
              <tr className="text-left text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                <th className="py-1">Variant</th>
                <th className="py-1 text-right">Now</th>
                <th className="py-1 text-right">After</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((l) => (
                <tr key={l.row}>
                  <td className="py-1">
                    {combos[l.row]?.join(" / ") || "Variant"}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(l.before)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(l.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length === 0 && (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              No chosen variant has a price to start from.
            </p>
          )}
        </div>
      </Dialog>
    </>
  )
}
