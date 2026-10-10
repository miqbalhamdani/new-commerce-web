"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { ApiError } from "@/lib/api/client"
import type { ProductPage, Variant } from "@/lib/api/types"
import { asApiError, useApi } from "@/lib/api/use-api"
import { formatMoney } from "@/lib/format"

/**
 * Finds a variant to add as a line (P1-110): search the catalog, pick a
 * product, pick one of its variants. Prices shown come from variant_price()
 * via the API and are display only (BR-046).
 */
export function LinePicker({
  onPick,
}: {
  onPick: (v: { variant_id: string; title: string; sku: string; unit_price: number }) => void
}) {
  const api = useApi()
  const [results, setResults] = useState<ProductPage["data"]>([])
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [searched, setSearched] = useState(false)

  async function search(q: string) {
    if (!q.trim()) return
    try {
      const page = await api<ProductPage>(
        `/v1/products?q=${encodeURIComponent(q.trim())}&status=active&limit=10`,
      )
      setResults(page.data)
      setPicked(null)
      setSearched(true)
      setError(null)
    } catch (err) {
      setError(asApiError(err))
    }
  }

  async function pick(p: { id: string; title: string }) {
    try {
      const { data } = await api<{ data: Variant[] }>(`/v1/products/${p.id}/variants`)
      setPicked(p)
      setVariants(data.filter((v) => !v.archived_at))
      setError(null)
    } catch (err) {
      setError(asApiError(err))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        aria-label="Search the catalog"
        placeholder="Search products, Enter to look up"
        className="w-full max-w-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            void search(e.currentTarget.value)
          }
        }}
      />
      <ErrorNotice error={error} title="Could not search the catalog" />
      {searched && results.length === 0 && (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Nothing in the live catalog matches.
        </p>
      )}
      {results.length > 0 && !picked && (
        <ul className="flex flex-col gap-1">
          {results.map((p) => (
            <li key={p.id}>
              <Button size="sm" variant="ghost" onClick={() => void pick(p)}>
                {p.title}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <div>
          <p className="mb-1 text-theme-sm text-gray-500 dark:text-gray-400">
            {picked.title} — pick a variant:
          </p>
          <ul className="flex flex-wrap gap-2">
            {variants.length === 0 && (
              <li className="text-theme-sm text-gray-500">No live variants.</li>
            )}
            {variants.map((v) => (
              <li key={v.id}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onPick({
                      variant_id: v.id,
                      title:
                        v.option_values.length > 0
                          ? `${picked.title} — ${v.option_values.join(" / ")}`
                          : picked.title,
                      sku: v.sku ?? "",
                      unit_price: v.price,
                    })
                    setPicked(null)
                    setResults([])
                    setSearched(false)
                  }}
                >
                  {v.option_values.length > 0 ? v.option_values.join(" / ") : "Default"}
                  {v.sku ? ` · ${v.sku}` : ""} · {formatMoney(v.price)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
