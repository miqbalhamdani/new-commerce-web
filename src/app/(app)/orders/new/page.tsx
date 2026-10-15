"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { X } from "lucide-react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field, Textarea } from "@/components/ui/common/Field"
import {
  bodyRows,
  headerRow,
  ListTable,
  td,
  th,
} from "@/components/ui/common/Listing"
import { Card, Empty, Page, Section } from "@/components/ui/common/Page"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LinePicker } from "@/components/ui/orders/LinePicker"
import { ShippingQuotePicker } from "@/components/ui/orders/ShippingQuotePicker"
import { ApiError } from "@/lib/api/client"
import type { Order } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import { formatMoney, groupDigits, parseMoney } from "@/lib/format"
import {
  canQuote,
  canSubmit,
  createBody,
  emptyDraft,
  lineError,
  quoteBody,
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

  // A picked courier was quoted for this postal code and these lines; any
  // change to either drops it, and the picker remounts empty (BR-121).
  function set(next: Partial<NewOrderDraft>) {
    const requote = "postal_code" in next || "lines" in next
    setDraft((d) => ({
      ...d,
      ...next,
      ...(requote ? { shipping_option: null } : {}),
    }))
  }
  function setLine(i: number, next: Partial<NewOrderDraft["lines"][number]>) {
    setDraft((d) => ({
      ...d,
      shipping_option: "qty" in next ? null : d.shipping_option,
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
      title="New order"
      description="A WhatsApp order, priced from the catalog."
    >
      <form id="new-order" onSubmit={submit}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]">
          <div className="flex flex-col gap-6">
            <Section title="Customer">
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
                    type="tel"
                    value={draft.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Shipping address">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <Field id="new-line1" label="Address" error={field("shipping_address")}>
                    <Input
                      id="new-line1"
                      value={draft.line1}
                      onChange={(e) => set({ line1: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-3">
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
                    inputMode="numeric"
                    value={draft.postal_code}
                    onChange={(e) => set({ postal_code: e.target.value })}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Items" description="Prices come from the catalog.">
              <LinePicker
                onPick={(v) =>
                  set({ lines: [...draft.lines, { ...v, qty: 1, discount: "" }] })
                }
              />
              <div className="mt-4">
                {draft.lines.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-theme-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    No items yet. Search the catalog to add one.
                  </p>
                ) : (
                  <ListTable>
                    <TableHeader className={headerRow}>
                      <TableRow>
                        <TableCell isHeader className={th}>
                          Item
                        </TableCell>
                        <TableCell isHeader className={`${th} text-right`}>
                          Unit price
                        </TableCell>
                        <TableCell isHeader className={th}>
                          Qty
                        </TableCell>
                        <TableCell isHeader className={th}>
                          Discount (Rp)
                        </TableCell>
                        <TableCell isHeader className={`${th} text-right`}>
                          Total
                        </TableCell>
                        <TableCell isHeader className={`${th} w-px`}>
                          <span className="sr-only">Remove</span>
                        </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={bodyRows}>
                      {draft.lines.map((l, i) => {
                        const lineErr =
                          lineError(error, i, "variant_id") ??
                          lineError(error, i, "qty") ??
                          lineError(error, i, "discount")
                        return (
                          <TableRow key={`${l.variant_id}-${i}`}>
                            <TableCell className={td}>
                              <p className="font-medium text-gray-800 dark:text-white/90">
                                {l.title}
                              </p>
                              {l.sku && (
                                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                                  {l.sku}
                                </p>
                              )}
                              {lineErr && (
                                <p role="alert" className="mt-1 text-theme-xs text-error-500">
                                  {lineErr}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className={`${td} text-right tabular-nums`}>
                              {formatMoney(l.unit_price)}
                            </TableCell>
                            <TableCell className={`${td} !py-2`}>
                              <Input
                                id={`line-${i}-qty`}
                                aria-label={`Qty for ${l.title}`}
                                type="number"
                                min="1"
                                className="w-20"
                                value={String(l.qty)}
                                onChange={(e) =>
                                  setLine(i, { qty: Math.max(1, Number(e.target.value) || 1) })
                                }
                              />
                            </TableCell>
                            <TableCell className={`${td} !py-2`}>
                              <Input
                                id={`line-${i}-discount`}
                                aria-label={`Discount for ${l.title}`}
                                inputMode="numeric"
                                placeholder="0"
                                className="w-32"
                                value={l.discount}
                                onChange={(e) =>
                                  setLine(i, { discount: groupDigits(e.target.value) })
                                }
                              />
                            </TableCell>
                            <TableCell className={`${td} text-right font-medium tabular-nums`}>
                              {formatMoney(
                                l.unit_price * l.qty - (parseMoney(l.discount) ?? 0),
                              )}
                            </TableCell>
                            <TableCell className={`${td} !py-2`}>
                              <button
                                type="button"
                                aria-label={`Remove ${l.title}`}
                                className="flex size-10 items-center justify-center rounded-lg text-gray-400 hover:bg-error-50 hover:text-error-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500/30 dark:hover:bg-error-500/10"
                                onClick={() =>
                                  set({ lines: draft.lines.filter((_, j) => j !== i) })
                                }
                              >
                                <X aria-hidden className="size-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </ListTable>
                )}
              </div>
              {fieldError(error, "lines") && (
                <p role="alert" className="mt-2 text-theme-xs text-error-500">
                  {fieldError(error, "lines")}
                </p>
              )}
            </Section>
          </div>

          {/* Shipping and the summary stay in view while the lines grow; the
              create button sits under the total it commits to. */}
          <aside className="flex flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
            <Section title="Shipping">
              <div className="flex flex-col gap-4">
                <ShippingQuotePicker
                  key={JSON.stringify(quoteBody(draft))}
                  body={quoteBody(draft)}
                  disabled={!canQuote(draft)}
                  picked={draft.shipping_option}
                  onPick={(o) => set({ shipping_option: o, shipping: "" })}
                />
                {(field("shipping_option") ?? field("shipping")) && (
                  <p role="alert" className="text-theme-xs text-error-500">
                    {field("shipping_option") ?? field("shipping")}
                  </p>
                )}
                {!draft.shipping_option && (
                  <Field
                    id="new-shipping"
                    label="Or type a shipping amount (Rp)"
                    hint="For a courier you arrange yourself."
                  >
                    <Input
                      id="new-shipping"
                      inputMode="numeric"
                      value={draft.shipping}
                      onChange={(e) => set({ shipping: groupDigits(e.target.value) })}
                    />
                  </Field>
                )}
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

            <Card className="p-5 sm:p-6">
              <div className="rounded-xl bg-gray-50 p-4 text-theme-sm sm:p-5 dark:bg-white/[0.03]">
                <p className="mb-3 font-medium text-gray-800 dark:text-white/90">
                  Order summary
                </p>
                <dl className="grid gap-2.5">
                  {(
                    [
                      ["Subtotal", t.subtotal],
                      ["Shipping", t.shipping],
                      ["Discount", -t.discount || 0],
                    ] as const
                  ).map(([label, amount]) => (
                    <div key={label} className="flex justify-between gap-8">
                      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                      <dd className="tabular-nums text-gray-800 dark:text-white/90">
                        {formatMoney(amount)}
                      </dd>
                    </div>
                  ))}
                  <div className="mt-1 flex items-baseline justify-between gap-8 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <dt className="font-semibold text-gray-800 dark:text-white/90">
                      Total
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums text-gray-800 dark:text-white/90">
                      {formatMoney(t.total)}
                    </dd>
                  </div>
                </dl>
              </div>
              <Button
                type="submit"
                className="mt-5 w-full"
                isLoading={busy}
                disabled={!canSubmit(draft)}
              >
                Create order
              </Button>
              <p className="mt-2 text-center text-theme-xs text-gray-500 dark:text-gray-400">
                Prices are checked again when you create the order.
              </p>
              {error && !error.problem.errors?.length && (
                <div className="mt-4">
                  <ErrorNotice error={error} title="Could not create the order" />
                </div>
              )}
            </Card>
          </aside>
        </div>
      </form>
    </Page>
  )
}
