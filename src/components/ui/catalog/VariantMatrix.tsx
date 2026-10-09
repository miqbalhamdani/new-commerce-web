"use client"

import { X } from "lucide-react"
import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Checkbox } from "@/components/ui/common/Field"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { PlusIcon } from "@/icons"
import { ApiError } from "@/lib/api/client"
import type { Product, Variant, VariantMatrixResult } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import {
  columns,
  emptyRow,
  fillDown,
  label,
  paste,
  rowsOf,
  toRequest,
  type Column,
  type Row,
  type VariantRow,
} from "@/lib/catalog/matrix"
import { cx } from "@/lib/utils"

const columnLabel: Record<Column, string> = {
  sku: "SKU",
  regular_price: "Price (Rp)",
  sale_price: "Sale price (Rp)",
  weight_grams: "Weight (g)",
}

const fieldLabel =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"

/**
 * The variants editor (P1-046, 04-api-spec.md §7.3): the product's options
 * named once, then a card per variant with a value for each option and its
 * prices. Every card saves in one request at the product's version; a card
 * the server refuses keeps what was typed and shows its error, the rest stay
 * saved (BR-041). A removed card's variant is archived.
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
  const [names, setNames] = useState<string[]>([])
  const [rows, setRowsState] = useState<VariantRow[]>([])
  const [rowErrors, setRowErrors] = useState<Map<number, string>>(new Map())
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dirty, setDirty] = useState(false)

  // Re-seed from a fresh variants fetch, but never over unsaved typing: a
  // late fetch or a refused card must keep what was typed.
  if (variants && variants !== seeded && !dirty) {
    setSeeded(variants)
    setNames(product.option_names)
    setRowsState(rowsOf(variants.data))
    setDirty(false)
  }

  function setRows(next: VariantRow[]) {
    setRowsState(next)
    setDirty(true)
  }

  // Removing a card or an option shifts rows, so selections and errors by
  // index no longer point at the right card.
  function reshape(nextNames: string[], nextRows: VariantRow[]) {
    setNames(nextNames)
    setRows(nextRows)
    setSelected(new Set())
    setRowErrors(new Map())
    setFocus(null)
  }

  async function save() {
    const { body, errors } = toRequest(names, rows)
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
      if (failed.size) {
        // Keep the cards as typed; the saved ones now have their variant.
        setRowsState(
          rows.map((r, i) => ({
            ...r,
            id: res.results[i]?.variant_id ?? r.id,
          })),
        )
      } else {
        setDirty(false)
        reload()
      }
      onSaved()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-400">
          Options
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {names.map((name, j) => (
            <div key={j} className="flex items-center gap-1">
              <Input
                aria-label={`Option ${j + 1} name`}
                placeholder="e.g. Size"
                className="w-36"
                value={name}
                disabled={!canWrite}
                onChange={(e) => {
                  setNames(names.map((n, k) => (k === j ? e.target.value : n)))
                  setDirty(true)
                }}
              />
              {canWrite && (
                <IconButton
                  label={`Remove option ${name || j + 1}`}
                  onClick={() =>
                    reshape(
                      names.filter((_, k) => k !== j),
                      rows.map((r) => ({
                        ...r,
                        values: r.values.filter((_, k) => k !== j),
                      })),
                    )
                  }
                />
              )}
            </div>
          ))}
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              startIcon={<PlusIcon aria-hidden className="size-4" />}
              onClick={() =>
                reshape(
                  [...names, names.length === 0 ? "Colour" : "Size"],
                  rows.map((r) => ({ ...r, values: [...r.values, ""] })),
                )
              }
            >
              Add option
            </Button>
          )}
        </div>
        {canWrite && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {names.length
              ? "Every variant needs a value for each option. Colour goes first when there is one."
              : "Sold in colours or sizes? Add an option first, e.g. Colour or Size."}
          </p>
        )}
      </div>

      {children?.({
        rows,
        setRows: (next) => setRows(next.map((r, i) => ({ ...rows[i], ...r }))),
        selected,
        combos: rows.map((r) => r.values),
      })}

      {names.map((_, j) => (
        <datalist key={j} id={`option-${j}-values`}>
          {[...new Set(rows.map((r) => r.values[j]).filter(Boolean))].map(
            (v) => (
              <option key={v} value={v} />
            ),
          )}
        </datalist>
      ))}

      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-theme-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            No variants yet.
            {canWrite &&
              " Add one; add options first if it comes in colours or sizes."}
          </p>
        )}
        {rows.map((r, i) => {
          const problem =
            rowErrors.get(i) ?? (r.id ? highlight?.get(r.id) : undefined)
          const title =
            r.values.filter(Boolean).join(" / ") ||
            (names.length ? "New variant" : "Default variant")
          return (
            <fieldset
              key={r.id ?? `new-${i}`}
              aria-label={`Variant ${title}`}
              data-row={i}
              className={cx(
                "rounded-2xl border p-4",
                problem
                  ? "border-error-300 bg-error-50/50 dark:border-error-500/40 dark:bg-error-500/10"
                  : "border-gray-200 dark:border-gray-800",
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                {canWrite && (
                  <Checkbox
                    aria-label={`Select ${label(r.values)}`}
                    checked={selected.has(i)}
                    onChange={(e) => {
                      const s = new Set(selected)
                      if (e.target.checked) s.add(i)
                      else s.delete(i)
                      setSelected(s)
                    }}
                  />
                )}
                <p className="flex-1 truncate text-sm font-medium text-gray-800 dark:text-white/90">
                  {title}
                </p>
                {canWrite && (
                  <IconButton
                    label={`Remove variant ${label(r.values)}`}
                    onClick={() =>
                      reshape(
                        names,
                        rows.filter((_, k) => k !== i),
                      )
                    }
                  />
                )}
              </div>
              {names.length > 0 && (
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  {names.map((name, j) => (
                    <label key={j}>
                      <span className={fieldLabel}>{name || "Option"}</span>
                      <Input
                        aria-label={`${name || "Option"} for variant ${i + 1}`}
                        list={`option-${j}-values`}
                        value={r.values[j] ?? ""}
                        disabled={!canWrite}
                        error={
                          problem?.startsWith("Fill in") && !r.values[j]?.trim()
                        }
                        onChange={(e) =>
                          setRows(
                            rows.map((x, k) =>
                              k === i
                                ? {
                                    ...x,
                                    values: x.values.map((v, m) =>
                                      m === j ? e.target.value : v,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {columns.map((c, col) => (
                  <label key={c}>
                    <span className={fieldLabel}>{columnLabel[c]}</span>
                    <Input
                      id={r.id ? `cell-${r.id}-${c}` : undefined}
                      aria-label={`${columnLabel[c]} for ${label(r.values)}`}
                      value={r[c]}
                      disabled={!canWrite}
                      inputMode={c === "sku" ? "text" : "numeric"}
                      error={Boolean(problem)}
                      onFocus={() => setFocus({ row: i, col })}
                      onChange={(e) =>
                        setRows(
                          rows.map((x, k) =>
                            k === i ? { ...x, [c]: e.target.value } : x,
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
                  </label>
                ))}
              </div>
              {problem && (
                <p
                  role="alert"
                  className="mt-3 text-xs text-error-600 dark:text-error-400"
                >
                  {problem}
                </p>
              )}
            </fieldset>
          )
        })}
      </div>

      <ErrorNotice error={error} title="Could not save the variants" />
      {canWrite && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            startIcon={<PlusIcon aria-hidden className="size-4" />}
            onClick={() =>
              setRows([...rows, { ...emptyRow, values: names.map(() => "") }])
            }
          >
            Add variant
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!focus}
              onClick={() =>
                focus && setRows(fillDown(rows, focus.row, columns[focus.col]))
              }
            >
              Fill down
            </Button>
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
    </div>
  )
}

function IconButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
    >
      <X aria-hidden className="size-4" />
    </button>
  )
}
