"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { X } from "lucide-react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field, Textarea } from "@/components/ui/common/Field"
import { Empty, Page, Section } from "@/components/ui/common/Page"
import { LinePicker } from "@/components/ui/orders/LinePicker"
import { ApiError } from "@/lib/api/client"
import type { Order } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import { formatMoney, groupDigits } from "@/lib/format"
import {
  canSubmit,
  createBody,
  emptyDraft,
  lineError,
  totals,
  type NewOrderDraft,
} from "@/lib/orders/new-order"

// P1-110: manual (WhatsApp) order entry, priced from the catalog (§5.4;
// BR-046, BR-076, BR-078).

export default function NewOrderPage() {
  const router = useRouter()
  const api = useApi()
  const canWrite = useCan("orders:write")
  const [draft, setDraft] = useState<NewOrderDraft>(emptyDraft)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  if (!canWrite) {
    return (
      <Page title="New order">
        <Empty title="You don't have access to enter orders." />
      </Page>
    )
  }

  function set(next: Partial<NewOrderDraft>) {
    setDraft((d) => ({ ...d, ...next }))
  }
  function setLine(i: number, next: Partial<NewOrderDraft["lines"][number]>) {
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l, j) => (j === i ? { ...l, ...next } : l)),
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const o = await api<Order>("/v1/orders", {
        method: "POST",
        body: createBody(draft),
      })
      router.push(`/orders/${o.id}`)
    } catch (err) {
      setError(asApiError(err))
      setBusy(false)
    }
    // Keep busy=true on success: the submit stays disabled until the detail
    // page takes over (BR-078).
  }

  const t = totals(draft)
  const field = (name: string) => fieldError(error, name)

  return (
    <Page
      wide
      back={
        <Link
          href="/orders"
          className="text-theme-sm text-gray-500 hover:text-brand-500 dark:text-gray-400"
        >
          ← Orders
        </Link>
      }
      title="New order"
      description="A WhatsApp order, priced from the catalog."
      actions={
        <Button form="new-order" type="submit" isLoading={busy} disabled={!canSubmit(draft)}>
          Create order
        </Button>
      }
    >
      <form id="new-order" onSubmit={submit}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]">
          <div className="flex flex-col gap-6">
            <Section title="Customer" description="Snapshotted onto the order (BR-076).">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="cust-name" label="Name" error={field("customer.name")}>
                  <Input
                    id="cust-name"
                    value={draft.name}
                    error={Boolean(field("customer.name"))}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </Field>
                <Field id="cust-email" label="Email" hint="Optional." error={field("customer.email")}>
                  <Input
                    id="cust-email"
                    type="email"
                    value={draft.email}
                    onChange={(e) => set({ email: e.target.value })}
                  />
                </Field>
                <Field id="cust-phone" label="Phone" hint="Optional." error={field("customer.phone")}>
                  <Input
                    id="cust-phone"
                    value={draft.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Shipping address">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field id="new-line1" label="Address" error={field("shipping_address")}>
                    <Input
                      id="new-line1"
                      value={draft.line1}
                      onChange={(e) => set({ line1: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field id="new-line2" label="Address line 2" hint="Optional.">
                    <Input
                      id="new-line2"
                      value={draft.line2}
                      onChange={(e) => set({ line2: e.target.value })}
                    />
                  </Field>
                </div>
                <Field id="new-city" label="City">
                  <Input
                    id="new-city"
                    value={draft.city}
                    onChange={(e) => set({ city: e.target.value })}
                  />
                </Field>
                <Field id="new-province" label="Province">
                  <Input
                    id="new-province"
                    value={draft.province}
                    onChange={(e) => set({ province: e.target.value })}
                  />
                </Field>
                <Field id="new-postal" label="Postal code">
                  <Input
                    id="new-postal"
                    value={draft.postal_code}
                    onChange={(e) => set({ postal_code: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Lines"
              description="The server prices every line from the catalog (BR-078)."
            >
              {draft.lines.length > 0 && (
                <ul className="mb-4 flex flex-col gap-3">
                  {draft.lines.map((l, i) => (
                    <li key={`${l.variant_id}-${i}`} className="flex flex-wrap items-start gap-3">
                      <div className="min-w-40 flex-1">
                        <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {l.title}
                        </p>
                        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                          {l.sku ? `${l.sku} · ` : ""}
                          {formatMoney(l.unit_price)}
                        </p>
                        {(lineError(error, i, "variant_id") ??
                          lineError(error, i, "qty") ??
                          lineError(error, i, "discount")) && (
                          <p role="alert" className="text-theme-xs text-error-500">
                            {lineError(error, i, "variant_id") ??
                              lineError(error, i, "qty") ??
                              lineError(error, i, "discount")}
                          </p>
                        )}
                      </div>
                      <Field id={`line-${i}-qty`} label="Qty">
                        <Input
                          id={`line-${i}-qty`}
                          type="number"
                          min="1"
                          className="w-20"
                          value={String(l.qty)}
                          onChange={(e) =>
                            setLine(i, { qty: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                      </Field>
                      <Field id={`line-${i}-discount`} label="Discount (Rp)">
                        <Input
                          id={`line-${i}-discount`}
                          inputMode="numeric"
                          className="w-32"
                          value={l.discount}
                          onChange={(e) => setLine(i, { discount: groupDigits(e.target.value) })}
                        />
                      </Field>
                      <button
                        type="button"
                        aria-label={`Remove ${l.title}`}
                        className="mt-8 text-gray-400 hover:text-error-500"
                        onClick={() =>
                          set({ lines: draft.lines.filter((_, j) => j !== i) })
                        }
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <LinePicker
                onPick={(v) =>
                  set({ lines: [...draft.lines, { ...v, qty: 1, discount: "" }] })
                }
              />
              {fieldError(error, "lines") && (
                <p role="alert" className="mt-2 text-theme-xs text-error-500">
                  {fieldError(error, "lines")}
                </p>
              )}
            </Section>
          </div>

          <aside className="flex flex-col gap-6">
            <Section title="Shipping and note">
              <div className="flex flex-col gap-4">
                <Field
                  id="new-shipping"
                  label="Shipping (Rp)"
                  hint="A typed amount; courier rates arrive in Phase 3."
                  error={field("shipping")}
                >
                  <Input
                    id="new-shipping"
                    inputMode="numeric"
                    value={draft.shipping}
                    onChange={(e) => set({ shipping: groupDigits(e.target.value) })}
                  />
                </Field>
                <Field id="new-note" label="Note" hint="Optional." error={field("note")}>
                  <Textarea
                    id="new-note"
                    rows={2}
                    value={draft.note}
                    onChange={(e) => set({ note: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Totals" description="A preview; the server recomputes it.">
              <dl className="grid gap-1 text-theme-sm">
                {(
                  [
                    ["Subtotal", t.subtotal],
                    ["Shipping", t.shipping],
                    ["Discount", -t.discount],
                  ] as const
                ).map(([label, amount]) => (
                  <div key={label} className="flex justify-between gap-8">
                    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className="tabular-nums">{formatMoney(amount)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-8 border-t border-gray-200 pt-1 font-medium dark:border-gray-800">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMoney(t.total)}</dd>
                </div>
              </dl>
            </Section>

            {error && !error.problem.errors?.length && (
              <ErrorNotice error={error} title="Could not create the order" />
            )}
          </aside>
        </div>
      </form>
    </Page>
  )
}
