"use client"

import { HelpCircle, Plus, Trash2, X } from "lucide-react"
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
  carry,
  columns,
  emptyRow,
  fillDown,
  gridOf,
  key,
  live,
  paste,
  toRequest,
  visible,
  type Axis,
  type Column,
  type Row,
} from "@/lib/catalog/matrix"
import { groupDigits } from "@/lib/format"
import { cx } from "@/lib/utils"

const columnLabel: Record<Column, string> = {
  sku: "SKU",
  regular_price: "Regular price",
  sale_price: "Sale price",
  weight_grams: "Weight",
}

const isPrice = (c: Column) => c === "regular_price" || c === "sale_price"

/** Prices show grouped in threes ("150,000"), however they arrived. */
const tidy = (r: Row): Row => ({
  ...r,
  regular_price: groupDigits(r.regular_price),
  sale_price: groupDigits(r.sale_price),
})

type Confirm = {
  title: string
  description: string
  action: string
  onConfirm: () => void
}

/**
 * The variant matrix (P1-046, 04-api-spec.md §7.3) in two steps: name the
 * options and their values, then price every combination. The whole grid
 * saves in one request at the product's version; a row the server refuses
 * is highlighted with its error and the rest stay saved (BR-041). What was
 * typed survives option changes (carry); anything that removes rows asks
 * first.
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
  /** Bulk tools for the toolbar, e.g. Adjust prices (P1-047). */
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
  const [cells, setCells] = useState<Map<string, Row>>(new Map())
  const [rowErrors, setRowErrors] = useState<Map<number, string>>(new Map())
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dirty, setDirty] = useState(false)
  const [confirm, setConfirm] = useState<Confirm | null>(null)

  // Seed from a fresh variants fetch, but never over unsaved edits: a late
  // fetch or a partly refused save must keep what was typed.
  if (variants && variants !== seeded && !dirty) {
    const g = gridOf(product.option_names, variants.data)
    setSeeded(variants)
    setAxes(g.axes)
    setCells(new Map([...g.cells].map(([k, r]) => [k, tidy(r)])))
    setRemoved(g.removed)
  }

  const shown = live(axes)
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
    grid.forEach((c, i) => m.set(key(c), tidy(next[i])))
    setCells(m)
    setDirty(true)
  }

  // Rows shift when the grid changes shape, so selections, errors and the
  // Fill down cell by index no longer point at the right row.
  function reshape() {
    setSelected(new Set())
    setRowErrors(new Map())
    setFocus(null)
    setDirty(true)
  }

  /** Change the options; what was typed moves with them (carry). */
  function changeAxes(after: Axis[], from: (number | undefined)[]) {
    const next = carry(axes, after, from, cells, removed)
    setAxes(after)
    setCells(next.cells)
    setRemoved(next.removed)
    reshape()
  }

  const sameShape = (i: number, axis: Axis) =>
    changeAxes(
      axes.map((a, j) => (j === i ? axis : a)),
      axes.map((_, j) => j),
    )

  function askRemoveOption(i: number) {
    const after = axes.filter((_, j) => j !== i)
    const from = after.map((_, n) => (n < i ? n : n + 1))
    const count = visible(
      after,
      carry(axes, after, from, cells, removed).removed,
    ).length
    const name = axes[i].name || "this"
    setConfirm({
      title: `Remove the ${name} option?`,
      description: axes[i].values.length
        ? `Its ${axes[i].values.length} value${axes[i].values.length === 1 ? "" : "s"} go, and the ${grid.length} variants become ${count}. Prices you typed stay on the first matching row. Nothing changes on your store until you save the variants.`
        : "It has no values yet, so no variant changes.",
      action: "Remove option",
      onConfirm: () => changeAxes(after, from),
    })
  }

  function askRemoveValue(i: number, value: string) {
    const axis = axes[i]
    const pos = shown.indexOf(axis)
    const count = grid.filter((c) => c[pos] === value).length
    setConfirm({
      title: `Remove ${value}?`,
      description: `${count} variant${count === 1 ? "" : "s"} with ${value} go${count === 1 ? "es" : ""} when you save the variants.`,
      action: "Remove value",
      onConfirm: () =>
        sameShape(i, {
          ...axis,
          values: axis.values.filter((v) => v !== value),
        }),
    })
  }

  function askRemoveRow(combo: string[]) {
    setConfirm({
      title: `Remove ${combo.join(" / ")}?`,
      description:
        "It's removed from this product when you save the variants. Orders that include it keep it.",
      action: "Remove variant",
      onConfirm: () => {
        setRemoved(new Set(removed).add(key(combo)))
        reshape()
      },
    })
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

  const allSelected = grid.length > 0 && selected.size === grid.length
  const someSelected = selected.size > 0 && !allSelected
  const tools = canWrite && grid.length > 0

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="variant-options"
        className="flex flex-col gap-3"
      >
        <Step
          n={1}
          id="variant-options"
          title="Options"
          hint="What does this product come in? For example Colour: Red, Blue and Size: S, M, L."
        />
        {axes.map((axis, i) => (
          <AxisEditor
            key={i}
            axis={axis}
            canWrite={canWrite}
            onChange={(a) => sameShape(i, a)}
            onRemoveValue={(v) => askRemoveValue(i, v)}
            onRemove={() => askRemoveOption(i)}
          />
        ))}
        {canWrite && (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            startIcon={<Plus aria-hidden className="size-4" />}
            onClick={() =>
              changeAxes(
                [
                  ...axes,
                  { name: axes.length === 0 ? "Colour" : "Size", values: [] },
                ],
                [...axes.map((_, j) => j), undefined],
              )
            }
          >
            Add option
          </Button>
        )}
      </section>

      <section aria-labelledby="variant-rows" className="flex flex-col gap-3">
        <Step
          n={2}
          id="variant-rows"
          title={`Variants (${grid.length})`}
          hint={
            grid.length
              ? "Set the SKU, price and weight of each. You can paste a block of cells from Excel into any box."
              : "Add values to an option above. Every combination appears here as a variant."
          }
        />

        {tools && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
              <p className="text-theme-sm text-gray-600 dark:text-gray-400">
                {selected.size
                  ? `${selected.size} of ${grid.length} selected`
                  : "No rows ticked: Adjust prices changes every row"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  title="Click a cell first, then copy it to every row below"
                  aria-describedby="fill-down-hint"
                  disabled={!focus}
                  onClick={() =>
                    focus &&
                    setRows(fillDown(rows, focus.row, columns[focus.col]))
                  }
                >
                  {focus
                    ? `Fill down ${columnLabel[columns[focus.col]]}`
                    : "Fill down"}
                </Button>
                {children?.({ rows, setRows, selected, combos: grid })}
                <Help />
              </div>
              <p id="fill-down-hint" className="sr-only">
                Click a cell first, then copy it to every row below.
              </p>
            </div>
          </>
        )}

        {grid.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Variants">
              <thead>
                <tr className="border-b border-gray-100 text-left text-theme-xs font-medium text-gray-500 dark:border-white/[0.05] dark:text-gray-400">
                  {canWrite && (
                    <th className="w-8 py-2">
                      <Checkbox
                        aria-label="Select all variants"
                        checked={allSelected}
                        ref={(el: HTMLInputElement | null) => {
                          if (el) el.indeterminate = someSelected
                        }}
                        onChange={() =>
                          setSelected(
                            allSelected
                              ? new Set()
                              : new Set(grid.map((_, i) => i)),
                          )
                        }
                      />
                    </th>
                  )}
                  {shown.map((a, j) => (
                    <th key={j} className="py-2 pr-3 font-medium">
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
                        selected.has(i) &&
                          !problem &&
                          "bg-brand-50/40 dark:bg-brand-500/[0.06]",
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
                          className="py-1 pr-3 font-medium text-gray-800 dark:text-white/90"
                        >
                          {v}
                        </td>
                      ))}
                      {columns.map((c, col) => (
                        <td key={c} className="py-1 pr-3">
                          <div className="relative min-w-28">
                            {isPrice(c) && <Affix side="left">Rp</Affix>}
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
                              className={cx(
                                "!h-9 tabular-nums",
                                isPrice(c)
                                  ? "!pl-9 !pr-3"
                                  : c === "weight_grams"
                                    ? "!pl-3 !pr-7"
                                    : "!px-3",
                              )}
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
                                const text =
                                  e.clipboardData.getData("text/plain")
                                if (!/[\t\n]/.test(text)) return
                                e.preventDefault()
                                setRows(paste(rows, i, col, text))
                              }}
                            />
                            {c === "weight_grams" && (
                              <Affix side="right">g</Affix>
                            )}
                          </div>
                        </td>
                      ))}
                      {canWrite && grid.length > 1 && (
                        <td className="py-1">
                          <button
                            type="button"
                            aria-label={`Remove ${combo.join(" / ")}`}
                            onClick={() => askRemoveRow(combo)}
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
        )}

        <ErrorNotice error={error} title="Could not save the variants" />
        {canWrite && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {removed.size > 0 && (
                <button
                  type="button"
                  className="text-theme-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  onClick={() => {
                    setRemoved(new Set())
                    reshape()
                  }}
                >
                  Show {removed.size} removed
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {dirty && (
                <span className="text-theme-xs text-warning-600 dark:text-orange-400">
                  Unsaved changes
                </span>
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
          </div>
        )}
      </section>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                confirm?.onConfirm()
                setConfirm(null)
              }}
            >
              {confirm?.action}
            </Button>
          </>
        }
      />
    </div>
  )
}

function Step({
  n,
  id,
  title,
  hint,
}: {
  n: number
  id: string
  title: string
  hint: string
}) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
      >
        {n}
      </span>
      <div>
        <h3
          id={id}
          className="text-sm font-semibold text-gray-800 dark:text-white/90"
        >
          {title}
        </h3>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">{hint}</p>
      </div>
    </div>
  )
}

function Affix({
  side,
  children,
}: {
  side: "left" | "right"
  children: React.ReactNode
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none absolute inset-y-0 z-10 flex items-center text-theme-xs text-gray-400",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {children}
    </span>
  )
}

/** How the bulk tools work: a tooltip on the toolbar, shown on hover or focus. */
function Help() {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="How do Fill down and Adjust prices work?"
        aria-describedby="bulk-help"
        className="flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:text-gray-400 dark:hover:bg-white/5"
      >
        <HelpCircle aria-hidden className="size-5" />
      </button>
      <span
        id="bulk-help"
        role="tooltip"
        className="invisible absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 text-theme-sm text-gray-600 opacity-0 shadow-theme-lg transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-400"
      >
        <span className="block font-medium text-gray-800 dark:text-white/90">
          Fill down: one value on many rows
        </span>
        <span className="mt-1 block">
          Type a value in one row, keep that box selected, then click Fill down.
          Every row below gets the same value.
        </span>
        <span className="mt-3 block font-medium text-gray-800 dark:text-white/90">
          Adjust prices: change prices together
        </span>
        <span className="mt-1 block">
          Tick the rows to change (none means every row), click Adjust prices,
          pick the price, raise or lower, and an amount or %. Check the preview,
          Apply, then Save variants.
        </span>
      </span>
    </span>
  )
}

function AxisEditor({
  axis,
  canWrite,
  onChange,
  onRemoveValue,
  onRemove,
}: {
  axis: Axis
  canWrite: boolean
  onChange: (a: Axis) => void
  onRemoveValue: (value: string) => void
  onRemove: () => void
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
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-end dark:border-gray-800">
      <label className="sm:w-44">
        <span className="mb-1.5 block text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          Option name
        </span>
        <Input
          aria-label="Option name"
          value={axis.name}
          disabled={!canWrite}
          onChange={(e) => onChange({ ...axis, name: e.target.value })}
        />
      </label>
      <div className="min-w-0 flex-1">
        <span className="mb-1.5 block text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          Values
        </span>
        <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-gray-300 px-2 py-1.5 shadow-theme-xs focus-within:border-brand-300 focus-within:ring focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900">
          {axis.values.map((v) => (
            <span
              key={v}
              className="flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-2.5 pr-1.5 text-theme-xs font-medium text-gray-700 dark:bg-white/[0.08] dark:text-gray-300"
            >
              {v}
              {canWrite && (
                <button
                  type="button"
                  aria-label={`Remove ${v}`}
                  className="rounded-full p-0.5 hover:bg-gray-200 hover:text-error-600 dark:hover:bg-white/10"
                  onClick={() => onRemoveValue(v)}
                >
                  <X aria-hidden className="size-3" />
                </button>
              )}
            </span>
          ))}
          {canWrite && (
            <input
              aria-label={`Add a ${axis.name} value`}
              placeholder={
                axis.values.length ? "Add more…" : "Type values, e.g. S, M, L"
              }
              className="h-7 min-w-36 flex-1 border-0 bg-transparent px-1 text-sm text-gray-800 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 placeholder:text-gray-400 dark:text-white/90"
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
          )}
        </div>
      </div>
      {canWrite && (
        <button
          type="button"
          aria-label={`Remove option ${axis.name || ""}`.trim()}
          onClick={onRemove}
          className="flex size-11 shrink-0 items-center justify-center self-end rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500/30 dark:text-gray-400 dark:hover:bg-error-500/15 dark:hover:text-error-400"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}
