"use client"

import { useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field, Textarea } from "@/components/ui/common/Field"
import { ApiError } from "@/lib/api/client"
import type { Order } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"
import { groupDigits } from "@/lib/format"
import { draftOf, patchOf, type OrderDraft } from "@/lib/orders/order-form"

/**
 * The §5.2 PATCH (P1-109): address, note and shipping, editable only while
 * the order is pending, at the version in If-Match (BR-010, BR-079).
 */
export function OrderEditForm({
  order,
  onSaved,
}: {
  order: Order
  onSaved: (o: Order) => void
}) {
  const api = useApi()
  const [draft, setDraft] = useState<OrderDraft>(() => draftOf(order))
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  // Reseed when a transition or a save bumps the version.
  useEffect(() => {
    setDraft(draftOf(order))
  }, [order.id, order.version]) // eslint-disable-line react-hooks/exhaustive-deps -- draftOf(order) depends only on these

  const patch = patchOf(order, draft)
  const dirty = Object.keys(patch).length > 0

  // Leaving with unsaved edits deserves one warning (P1-034's pattern).
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function set(next: Partial<OrderDraft>) {
    setDraft((d) => ({ ...d, ...next }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const o = await api<Order>(`/v1/orders/${order.id}`, {
        method: "PATCH",
        body: patch,
        headers: { "If-Match": String(order.version) },
      })
      setError(null)
      onSaved(o)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const addressError = fieldError(error, "shipping_address")
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field id="addr-line1" label="Address" error={addressError}>
            <Input
              id="addr-line1"
              value={draft.line1}
              onChange={(e) => set({ line1: e.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="addr-line2" label="Address line 2" hint="Optional.">
            <Input
              id="addr-line2"
              value={draft.line2}
              onChange={(e) => set({ line2: e.target.value })}
            />
          </Field>
        </div>
        <Field id="addr-city" label="City">
          <Input
            id="addr-city"
            value={draft.city}
            onChange={(e) => set({ city: e.target.value })}
          />
        </Field>
        <Field id="addr-province" label="Province">
          <Input
            id="addr-province"
            value={draft.province}
            onChange={(e) => set({ province: e.target.value })}
          />
        </Field>
        <Field id="addr-postal" label="Postal code">
          <Input
            id="addr-postal"
            value={draft.postal_code}
            onChange={(e) => set({ postal_code: e.target.value })}
          />
        </Field>
        <Field
          id="order-shipping"
          label="Shipping (Rp)"
          error={fieldError(error, "shipping")}
        >
          <Input
            id="order-shipping"
            inputMode="numeric"
            value={draft.shipping}
            error={Boolean(fieldError(error, "shipping"))}
            onChange={(e) => set({ shipping: groupDigits(e.target.value) })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id="order-note" label="Note" error={fieldError(error, "note")}>
            <Textarea
              id="order-note"
              rows={2}
              value={draft.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {error?.code === "version_conflict" ? (
        <div
          role="alert"
          className="rounded-xl border border-warning-500 bg-warning-50 p-3 text-theme-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-orange-400"
        >
          Someone else changed this order while you were editing.{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => window.location.reload()}
          >
            Reload it
          </button>{" "}
          to see their changes; yours are not saved.
        </div>
      ) : (
        error &&
        !error.problem.errors?.length && (
          <ErrorNotice error={error} title="Could not save" />
        )
      )}

      <div className="flex justify-end">
        <Button size="sm" type="submit" isLoading={busy} disabled={!dirty}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
