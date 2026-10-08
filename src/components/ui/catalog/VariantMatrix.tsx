"use client"

import { X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Card } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { Product, Variant, VariantMatrixResult } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import {
  columns,
  combos,
  emptyRow,
  fillDown,
  gridOf,
  key,
  paste,
  toRequest,
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
  const [axes, setAxes] = useState<Axis[]>([])
  const [cells, setCells] = useState<Map<string, Row>>(new Map())
  const [rowErrors, setRowErrors] = useState<Map<number, string>>(new Map())
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!variants) return
    const g = gridOf(product.option_names, variants.data)
    setAxes(g.axes)
    setCells(g.cells)
    setDirty(false)
  }, [variants, product.option_names])

  const grid = useMemo(() => combos(axes), [axes])
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

  async function save() {
    const { body, errors } = toRequest(axes, rows)
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
      reload()
      onSaved()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6">
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
            variant="secondary"
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
        <p className="text-xs text-gray-500">
          {grid.length} variant{grid.length === 1 ? "" : "s"}. Paste a block
          from Excel into any cell; Colour comes first when there is one.
        </p>
      </div>

      {children?.({ rows, setRows, selected, combos: grid })}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Variants">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-800">
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
                    "border-b border-gray-100 dark:border-gray-900",
                    problem && "bg-red-50 dark:bg-red-950/40",
                  )}
                >
                  {canWrite && (
                    <td>
                      <input
                        type="checkbox"
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
                        hasError={Boolean(problem)}
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
                  {problem && (
                    <td
                      role="alert"
                      className="py-1 text-xs text-red-700 dark:text-red-400"
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

      <ErrorNotice error={error} title="Could not save the variants" />
      {canWrite && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            disabled={!focus}
            onClick={() =>
              focus && setRows(fillDown(rows, focus.row, columns[focus.col]))
            }
          >
            Fill down
          </Button>
          <Button
            isLoading={saving}
            disabled={!dirty && rowErrors.size === 0}
            onClick={save}
          >
            Save variants
          </Button>
        </div>
      )}
    </Card>
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
  function add() {
    const v = value.trim()
    if (v && !axis.values.includes(v))
      onChange({ ...axis, values: [...axis.values, v] })
    setValue("")
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-gray-200 p-2 dark:border-gray-800">
      <Input
        aria-label="Option name"
        className="w-32"
        value={axis.name}
        disabled={!canWrite}
        onChange={(e) => onChange({ ...axis, name: e.target.value })}
      />
      {axis.values.map((v) => (
        <span
          key={v}
          className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800"
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
            placeholder="Add value"
            className="w-28"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                add()
              }
            }}
          />
          <Button variant="ghost" onClick={() => onChange(null)}>
            Remove option
          </Button>
        </>
      )}
    </div>
  )
}
