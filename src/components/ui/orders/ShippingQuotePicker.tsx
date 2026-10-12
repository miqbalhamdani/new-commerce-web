"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { ApiError } from "@/lib/api/client"
import type { ShippingOption, ShippingQuote } from "@/lib/api/types"
import { asApiError, useApi } from "@/lib/api/use-api"
import { formatMoney } from "@/lib/format"
import { cx } from "@/lib/utils"

/**
 * Quote couriers for a manual order (P1-218, §5.4) and pick one. The page
 * remounts it (by key) when the postal code or lines change, so a quote never
 * outlives what it was for. The server quotes the pick again and charges that
 * price (BR-121).
 */
export function ShippingQuotePicker({
  body,
  disabled,
  picked,
  onPick,
}: {
  body: {
    destination_postal_code: string
    lines: { variant_id: string; qty: number }[]
  }
  disabled: boolean
  picked: ShippingOption | null
  onPick: (o: ShippingOption | null) => void
}) {
  const api = useApi()
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function fetchRates() {
    setBusy(true)
    try {
      setQuote(
        await api<ShippingQuote>("/v1/shipping/rates", {
          method: "POST",
          body,
        }),
      )
      setError(null)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const same = (o: ShippingOption) =>
    picked?.courier_code === o.courier_code &&
    picked?.courier_service_code === o.courier_service_code

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          type="button"
          variant="outline"
          isLoading={busy}
          disabled={disabled}
          onClick={fetchRates}
        >
          Quote shipping
        </Button>
        {disabled && (
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            Add lines and a 5-digit postal code first.
          </span>
        )}
      </div>
      <ErrorNotice error={error} title="Could not get shipping rates" />
      {quote && quote.options.length === 0 && (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          No couriers to quote. Set the shop&apos;s origin and couriers in
          Settings › Storefront, or type an amount.
        </p>
      )}
      {quote && quote.options.length > 0 && (
        <ul
          role="radiogroup"
          aria-label="Courier"
          className="flex flex-col gap-2"
        >
          {quote.options.map((o) => (
            <li key={`${o.courier_code}-${o.courier_service_code}`}>
              <button
                type="button"
                role="radio"
                aria-checked={same(o)}
                onClick={() => onPick(same(o) ? null : o)}
                className={cx(
                  "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-theme-sm",
                  same(o)
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/15"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-800",
                )}
              >
                <span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    {o.courier_name} {o.service_name}
                  </span>
                  <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                    {o.duration} · {Math.round(quote.weight_grams)} g
                  </span>
                </span>
                <span className="tabular-nums">{formatMoney(o.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
