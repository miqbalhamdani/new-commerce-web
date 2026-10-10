"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Dialog } from "@/components/ui/common/Dialog"
import { Field } from "@/components/ui/common/Field"
import { Select } from "@/components/ui/common/Select"
import {
  applyAdjustment,
  previewAdjustment,
  type Adjustment,
} from "@/lib/catalog/adjust"
import type { Row } from "@/lib/catalog/matrix"
import { formatMoney, groupDigits } from "@/lib/format"

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
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Adjust prices {selected.size ? `(${selected.size} selected)` : "(all)"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Adjust prices"
        description={`Changes ${
          selected.size
            ? `the ${selected.size} selected variant${selected.size === 1 ? "" : "s"}`
            : `all ${rows.length} variants`
        }. Nothing is saved until you click Save variants.`}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="adjust-target" label="Price to change">
            <Select
              id="adjust-target"
              className="w-full"
              value={a.target}
              onChange={(v) =>
                setA({ ...a, target: v as Adjustment["target"] })
              }
              options={[
                { value: "regular_price", label: "Regular price" },
                { value: "sale_price", label: "Sale price" },
              ]}
            />
          </Field>
          <Field id="adjust-direction" label="Change">
            <Select
              id="adjust-direction"
              className="w-full"
              value={a.direction}
              onChange={(v) =>
                setA({ ...a, direction: v as Adjustment["direction"] })
              }
              options={[
                { value: "down", label: "Lower it" },
                { value: "up", label: "Raise it" },
              ]}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field id="adjust-amount" label="By">
              <div className="flex gap-2">
                <Input
                  id="adjust-amount"
                  className="tabular-nums"
                  inputMode="numeric"
                  value={
                    a.unit === "amount"
                      ? groupDigits(String(a.value))
                      : String(a.value)
                  }
                  onChange={(e) =>
                    setA({
                      ...a,
                      value:
                        Number(
                          e.target.value.replace(
                            a.unit === "amount" ? /\D/g : /[^\d.]/g,
                            "",
                          ),
                        ) || 0,
                    })
                  }
                />
                <Select
                  aria-label="Unit"
                  className="w-24 shrink-0"
                  value={a.unit}
                  onChange={(v) =>
                    setA({ ...a, unit: v as Adjustment["unit"] })
                  }
                  options={[
                    { value: "percent", label: "%" },
                    { value: "amount", label: "Rp" },
                  ]}
                />
              </div>
            </Field>
          </div>
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
