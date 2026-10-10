"use client"

import Link from "next/link"
import { use } from "react"

import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bodyRows,
  headerRow,
  ListTable,
  td,
  th,
} from "@/components/ui/common/Listing"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Card, Loading, Page, Section } from "@/components/ui/common/Page"
import { OrderEditForm } from "@/components/ui/orders/OrderEditForm"
import {
  OrderSourceBadge,
  OrderStatusBadge,
} from "@/components/ui/orders/OrderStatusBadge"
import { TransitionBar } from "@/components/ui/orders/TransitionBar"
import type { Order } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format"

// P1-109: the order detail (04-api-spec.md §5.2) -- status actions from
// allowed_transitions, the ship dialog, the refund record and the embedded
// audit trail.

export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const {
    data: order,
    setData,
    error,
    loading,
    reload,
  } = useResource<Order>(`/v1/orders/${id}`)

  if (loading && !order) return <Loading />
  if (!order)
    return (
      <div className="p-8">
        <ErrorNotice error={error} title="Could not load the order" />
      </div>
    )
  return <OrderDetail order={order} onChanged={setData} onReload={reload} />
}

const stamps = [
  ["placed_at", "Placed"],
  ["paid_at", "Paid"],
  ["shipped_at", "Shipped"],
  ["completed_at", "Completed"],
  ["cancelled_at", "Cancelled"],
  ["refunded_at", "Refund recorded"],
] as const

function OrderDetail({
  order,
  onChanged,
  onReload,
}: {
  order: Order
  onChanged: (o: Order) => void
  onReload: () => void
}) {
  const canWrite = useCan("orders:write")
  const { tenant } = useSession()
  const tz = tenant?.timezone
  const when = (iso: string | null) => formatDateTime(iso, tz)

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
      title={order.order_number}
      description={`Placed ${formatRelative(order.placed_at)}.`}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]">
        <div className="flex flex-col gap-6">
          <Section title="Lines" description="Snapshots from the catalog at the time of order.">
            <ListTable>
              <TableHeader className={headerRow}>
                <TableRow>
                  <TableCell isHeader className={th}>
                    Item
                  </TableCell>
                  <TableCell isHeader className={th}>
                    SKU
                  </TableCell>
                  <TableCell isHeader className={`${th} text-right`}>
                    Qty
                  </TableCell>
                  <TableCell isHeader className={`${th} text-right`}>
                    Unit price
                  </TableCell>
                  <TableCell isHeader className={`${th} text-right`}>
                    Discount
                  </TableCell>
                  <TableCell isHeader className={`${th} text-right`}>
                    Total
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className={bodyRows}>
                {order.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className={td}>{l.title}</TableCell>
                    <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                      {l.sku || "—"}
                    </TableCell>
                    <TableCell className={`${td} text-right tabular-nums`}>{l.qty}</TableCell>
                    <TableCell className={`${td} text-right tabular-nums`}>
                      {formatMoney(l.unit_price)}
                    </TableCell>
                    <TableCell className={`${td} text-right tabular-nums`}>
                      {l.discount ? formatMoney(l.discount) : "—"}
                    </TableCell>
                    <TableCell className={`${td} text-right tabular-nums`}>
                      {formatMoney(l.unit_price * l.qty - l.discount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ListTable>
            <dl className="ml-auto mt-4 grid max-w-xs gap-1 text-theme-sm">
              {(
                [
                  ["Subtotal", order.subtotal],
                  ["Shipping", order.shipping],
                  ["Discount", -order.discount],
                ] as const
              ).map(([label, amount]) => (
                <div key={label} className="flex justify-between gap-8">
                  <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                  <dd className="tabular-nums">{formatMoney(amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-8 border-t border-gray-200 pt-1 font-medium dark:border-gray-800">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </Section>

          <Section
            title="Shipping and note"
            description={
              order.status === "pending"
                ? "Editable until the order is paid (BR-079)."
                : "An order is editable only while pending."
            }
          >
            {order.status === "pending" && canWrite ? (
              <OrderEditForm order={order} onSaved={onChanged} />
            ) : (
              <dl className="grid gap-2 text-theme-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Address</dt>
                  <dd>
                    {[
                      order.shipping_address.line1,
                      order.shipping_address.line2,
                      order.shipping_address.city,
                      order.shipping_address.province,
                      order.shipping_address.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Note</dt>
                  <dd>{order.note ?? "—"}</dd>
                </div>
              </dl>
            )}
          </Section>

          <Section
            title="History"
            description="Every change, newest first — who, what, when (BR-073)."
          >
            {order.history.length === 0 ? (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Nothing has happened yet.
              </p>
            ) : (
              <ol className="flex flex-col gap-2 text-theme-sm">
                {order.history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{h.actor?.name ?? "System"}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {h.from && h.to ? (
                        <>
                          {h.from} → {h.to}
                        </>
                      ) : (
                        h.action.replace("order.", "")
                      )}
                    </span>
                    <span
                      className="ml-auto text-gray-400 dark:text-gray-500"
                      title={when(h.created_at)}
                    >
                      {formatRelative(h.created_at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <OrderStatusBadge status={order.status} />
              <OrderSourceBadge source={order.source} />
            </div>
            <dl className="mt-4 grid gap-1 text-theme-sm">
              {stamps.map(([key, label]) =>
                order[key] ? (
                  <div key={key} className="flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd>{when(order[key])}</dd>
                  </div>
                ) : null,
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Payment</dt>
                <dd>{order.payment_method === "midtrans" ? "Midtrans" : "Bank transfer"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">Attempts</dt>
                <dd>{order.payments.length === 0 ? "—" : order.payments.length}</dd>
              </div>
              {order.shipping_courier && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Chosen courier</dt>
                  <dd>
                    {order.shipping_courier}
                    {order.shipping_service ? ` · ${order.shipping_service}` : ""}
                  </dd>
                </div>
              )}
              {order.tracking_number && (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Tracking</dt>
                  <dd>
                    {order.courier} {order.tracking_number}
                  </dd>
                </div>
              )}
            </dl>
            {canWrite && (
              <div className="mt-5">
                <TransitionBar order={order} onChanged={onChanged} onReload={onReload} />
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 font-medium text-gray-800 dark:text-white/90">Customer</h2>
            <dl className="grid gap-1 text-theme-sm text-gray-500 dark:text-gray-400">
              <dd className="text-gray-800 dark:text-white/90">
                {order.customer_id ? (
                  <Link
                    href={`/customers/${order.customer_id}`}
                    className="hover:text-brand-500"
                  >
                    {order.customer.name}
                  </Link>
                ) : (
                  order.customer.name
                )}
              </dd>
              {order.customer.email && <dd>{order.customer.email}</dd>}
              {order.customer.phone && <dd>{order.customer.phone}</dd>}
            </dl>
          </Card>
        </aside>
      </div>
    </Page>
  )
}
