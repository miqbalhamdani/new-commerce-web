"use client"

import { Trash2, X } from "lucide-react"
import { useMemo, useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Dialog } from "@/components/ui/common/Dialog"
import { Checkbox } from "@/components/ui/common/Field"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { ApiError } from "@/lib/api/client"
import type { Product, Variant, VariantMatrixResult } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import {
  columns,
  emptyRow,
  fillDown,
  gridOf,
  key,
  paste,
  toRequest,
  visible,
  type Axis,
  type Column,
  type Row,
} from "@/lib/catalog/matrix"
import { cx } from "@/lib/utils"

const columnLabel: Record<Column, string> = {
  sku: "SKU",
  regular_price: "Regular price (Rp)",
  sale_price: "Sale price (Rp)",
  weight_grams: "Weight (g)",
}

/**
 * The variant matrix (P1-046, 04-api-spec.md §7.3). The whole grid saves in
 * one request at the product's version; a row the server refuses is
 * highlighted with its error and the rest stay saved (BR-041).
 */
export function VariantMatrix({
  product,
  canWrite,
  onSaved,
  highlight,
  children,
}: {
  product: Product
  canWrite: boolean
  onSaved: () => void
  /** Cells to flag from outside, e.g. publish-check failures by variant id (P1-075). */
  highlight?: Map<string, string>
  children?: (grid: {
    rows: Row[]
    setRows: (r: Row[]) => void
    selected: Set<number>
    combos: string[][]
  }) => React.ReactNode
}) {
  const api = useApi()
  const { data: variants, reload } = useResource<{ data: Variant[] }>(
    `/v1/products/${product.id}/variants`,
  )
  const [seeded, setSeeded] = useState<typeof variants>()
  const [axes, setAxes] = useState<Axis[]>([])
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [removing, setRemoving] = useState<string[] | null>(null)
  const [cells, setCells] = useState<Map<string, Row>>(new Map())
  const [rowErrors, setRowErrors] = useState<Map<number, string>>(new Map())
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dirty, setDirty] = useState(false)

  // Seed from a fresh variants fetch, but never over unsaved edits: a late
  // fetch or a partly refused save must keep what was typed.
  if (variants && variants !== seeded && !dirty) {
    const g = gridOf(product.option_names, variants.data)
    setSeeded(variants)
    setAxes(g.axes)
    setCells(g.cells)
    setRemoved(g.removed)
  }

  const grid = useMemo(() => visible(axes, removed), [axes, removed])
  const rows = grid.map((c) => cells.get(key(c)) ?? emptyRow)
  const variantIdByRow = useMemo(() => {
    const byKey = new Map(
      (variants?.data ?? []).map((v) => [key(v.option_values), v.id]),
    )
    return grid.map((c) => byKey.get(key(c)))
  }, [grid, variants])

  function setRows(next: Row[]) {
    const m = new Map(cells)
    grid.forEach((c, i) => m.set(key(c), next[i]))
    setCells(m)
    setDirty(true)
  }

  function setAxis(i: number, axis: Axis | null) {
    setAxes(
      axis === null
        ? axes.filter((_, j) => j !== i)
        : axes.map((a, j) => (j === i ? axis : a)),
    )
    setDirty(true)
  }

  // Rows shift when one goes or comes back, so selections and errors by
  // index no longer point at the right row.
  function setRemovedRows(next: Set<string>) {
    setRemoved(next)
    setSelected(new Set())
    setRowErrors(new Map())
    setFocus(null)
    setDirty(true)
  }

  async function save() {
    const { body, errors } = toRequest(axes, rows, removed)
    setRowErrors(errors)
    if (errors.size) return
    setSaving(true)
    try {
      const res = await api<VariantMatrixResult>(
        `/v1/products/${product.id}/variant-matrix`,
        {
          method: "PUT",
          body,
          headers: { "If-Match": String(product.version) },
        },
      )
      const failed = new Map<number, string>()
      res.results.forEach(
        (r, i) =>
          r.status === "error" &&
          failed.set(i, r.detail ?? r.code ?? "Not saved"),
      )
      setRowErrors(failed)
      setError(null)
      if (failed.size === 0) setDirty(false)
      reload()
      onSaved()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        {axes.map((axis, i) => (
          <AxisEditor
            key={i}
            axis={axis}
            canWrite={canWrite}
            onChange={(a) => setAxis(i, a)}
          />
        ))}
        {canWrite && (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => {
              setAxes([
                ...axes,
                { name: axes.length === 0 ? "Colour" : "Size", values: [] },
              ])
              setDirty(true)
            }}
          >
            Add option
          </Button>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {grid.length === 0
            ? canWrite &&
              "Type each option's values, e.g. Red, Blue and S, M, L. Every combination becomes a variant to price below."
            : `${grid.length} variant${grid.length === 1 ? "" : "s"}. Paste a block from Excel into any cell; Colour comes first when there is one.`}
        </p>
        {canWrite && grid.length > 1 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Click a cell, then{" "}
            <strong className="font-medium">Fill down</strong> to copy it to
            every row below. Tick rows and use{" "}
            <strong className="font-medium">Adjust prices</strong> to change
            them together, or leave all unticked to change every row.
          </p>
        )}
      </div>

      {grid.length > 0 && children?.({ rows, setRows, selected, combos: grid })}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Variants">
          <thead>
            <tr className="border-b border-gray-100 text-left text-theme-xs font-medium text-gray-500 dark:border-white/[0.05] dark:text-gray-400">
              {canWrite && (
                <th className="w-8 py-2">
                  <span className="sr-only">Select</span>
                </th>
              )}
              {axes.map((a) => (
                <th key={a.name} className="py-2 pr-3 font-medium">
                  {a.name}
                </th>
              ))}
              {columns.map((c) => (
                <th key={c} className="py-2 pr-3 font-medium">
                  {columnLabel[c]}
                </th>
              ))}
              {canWrite && grid.length > 1 && (
                <th className="w-9 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {grid.map((combo, i) => {
              const problem =
                rowErrors.get(i) ??
                (variantIdByRow[i]
                  ? highlight?.get(variantIdByRow[i]!)
                  : undefined)
              return (
                <tr
                  key={key(combo) || "single"}
                  data-row={i}
                  className={cx(
                    "border-b border-gray-100 dark:border-white/[0.05]",
                    problem && "bg-error-50 dark:bg-error-500/15",
                  )}
                >
                  {canWrite && (
                    <td>
                      <Checkbox
                        aria-label={`Select ${combo.join(" / ") || "variant"}`}
                        checked={selected.has(i)}
                        onChange={(e) => {
                          const s = new Set(selected)
                          if (e.target.checked) s.add(i)
                          else s.delete(i)
                          setSelected(s)
                        }}
                      />
                    </td>
                  )}
                  {combo.map((v, j) => (
                    <td
                      key={j}
                      className="py-1 pr-3 text-gray-700 dark:text-gray-300"
                    >
                      {v}
                    </td>
                  ))}
                  {columns.map((c, col) => (
                    <td key={c} className="py-1 pr-3">
                      <Input
                        id={
                          variantIdByRow[i]
                            ? `cell-${variantIdByRow[i]}-${c}`
                            : undefined
                        }
                        aria-label={`${columnLabel[c]} for ${combo.join(" / ") || "the variant"}`}
                        value={rows[i][c]}
                        disabled={!canWrite}
                        inputMode={c === "sku" ? "text" : "numeric"}
                        className="!h-9 !px-3"
                        error={Boolean(problem)}
                        onFocus={() => setFocus({ row: i, col })}
                        onChange={(e) =>
                          setRows(
                            rows.map((r, k) =>
                              k === i ? { ...r, [c]: e.target.value } : r,
                            ),
                          )
                        }
                        onPaste={(e) => {
                          const text = e.clipboardData.getData("text/plain")
                          if (!/[\t\n]/.test(text)) return
                          e.preventDefault()
                          setRows(paste(rows, i, col, text))
                        }}
                      />
                    </td>
                  ))}
                  {canWrite && grid.length > 1 && (
                    <td className="py-1">
                      <button
                        type="button"
                        aria-label={`Remove ${combo.join(" / ")}`}
                        onClick={() => setRemoving(combo)}
                        className="flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500/30 dark:text-gray-400 dark:hover:bg-error-500/15 dark:hover:text-error-400"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </td>
                  )}
                  {problem && (
                    <td
                      role="alert"
                      className="py-1 text-xs text-error-600 dark:text-error-400"
                    >
                      {problem}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canWrite && removed.size > 0 && (
        <button
          type="button"
          className="mt-2 text-theme-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          onClick={() => setRemovedRows(new Set())}
        >
          Show {removed.size} removed
        </button>
      )}

      <ErrorNotice error={error} title="Could not save the variants" />
      {canWrite && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {grid.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              title="Copy the selected cell into every row below it"
              disabled={!focus}
              onClick={() =>
                focus && setRows(fillDown(rows, focus.row, columns[focus.col]))
              }
            >
              Fill down
            </Button>
          )}
          <Button
            size="sm"
            isLoading={saving}
            disabled={!dirty && rowErrors.size === 0}
            onClick={save}
          >
            Save variants
          </Button>
        </div>
      )}

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.join(" / ")}?`}
        description="It's archived when you save the variants, and leaves your storefront. Orders that include it keep it."
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRemoving(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setRemovedRows(new Set(removed).add(key(removing!)))
                setRemoving(null)
              }}
            >
              Remove variant
            </Button>
          </>
        }
      />
    </div>
  )
}

function AxisEditor({
  axis,
  canWrite,
  onChange,
}: {
  axis: Axis
  canWrite: boolean
  onChange: (a: Axis | null) => void
}) {
  const [value, setValue] = useState("")
  // Enter, a comma or leaving the box all add what was typed; "S, M, L" adds
  // three. Nothing typed is ever silently dropped.
  function add(text = value) {
    const fresh = text
      .split(",")
      .map((v) => v.trim())
      .filter(
        (v, i, all) => v && !axis.values.includes(v) && all.indexOf(v) === i,
      )
    if (fresh.length) onChange({ ...axis, values: [...axis.values, ...fresh] })
    setValue("")
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
      <Input
        aria-label="Option name"
        className="!h-9 w-32"
        value={axis.name}
        disabled={!canWrite}
        onChange={(e) => onChange({ ...axis, name: e.target.value })}
      />
      {axis.values.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs font-medium text-gray-700 dark:bg-white/[0.08] dark:text-gray-300"
        >
          {v}
          {canWrite && (
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() =>
                onChange({
                  ...axis,
                  values: axis.values.filter((x) => x !== v),
                })
              }
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {canWrite && (
        <>
          <Input
            aria-label={`Add a ${axis.name} value`}
            placeholder="Add values: S, M, L"
            className="!h-9 w-44"
            value={value}
            onChange={(e) => {
              const v = e.target.value
              if (v.includes(",")) add(v)
              else setValue(v)
            }}
            onBlur={() => add()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Remove option
          </Button>
        </>
      )}
    </div>
  )
}
