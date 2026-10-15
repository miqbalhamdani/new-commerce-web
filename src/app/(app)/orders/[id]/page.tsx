"use client"

import {
  BadgeCheck,
  Ban,
  Banknote,
  CheckCircle2,
  CircleDot,
  Globe,
  Package,
  PencilLine,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react"
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
  OrderProgress,
  statusHint,
} from "@/components/ui/orders/OrderProgress"
import { OrderStatusBadge } from "@/components/ui/orders/OrderStatusBadge"
import { TransitionBar } from "@/components/ui/orders/TransitionBar"
import type { Order, OrderHistoryEntry } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatRelative,
  formatTime,
} from "@/lib/format"

/** A Midtrans attempt's state, for ops (BR-124, BR-125). */
const paymentStatus = {
  pending: "Waiting for payment",
  paid: "Paid",
  failed: "Failed or expired",
  amount_mismatch: "Amount does not match — check in Midtrans",
} as const

// P1-109: the order detail (04-api-spec.md §5.2) -- status actions from
// allowed_transitions, the ship dialog, the refund record and the embedded
// audit trail. The layout follows TailAdmin's single-transaction page: a
// header bar with the status and actions, the lines on the left, and the
// customer, details and history timeline on the right.

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
      title={order.order_number}
      description={`Placed ${formatRelative(order.placed_at)}.`}
    >
      {/* The header bar: status at a glance on the left, the §5.3 status
          actions on the right. */}
      <Card className="flex flex-col gap-4 p-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
        {/* Every fact in the bar carries its label, so neither badge has
            to be decoded; the hint says what the order is waiting for. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
            Status
            <OrderStatusBadge status={order.status} size="md" />
          </span>
          <span className="flex items-center gap-1.5 text-theme-sm text-gray-500 dark:text-gray-400">
            Source
            <span className="flex items-center gap-1 font-medium text-gray-800 dark:text-white/90">
              {order.source === "manual" ? (
                <PencilLine aria-hidden className="size-4 text-gray-500" />
              ) : (
                <Globe aria-hidden className="size-4 text-gray-500" />
              )}
              {order.source === "manual" ? "Manual order" : "Storefront"}
            </span>
          </span>
          <span
            aria-hidden
            className="hidden h-5 w-px bg-gray-200 sm:block dark:bg-gray-700"
          />
          <span className="text-theme-sm text-gray-500 dark:text-gray-400">
            Placed{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {when(order.placed_at)}
            </span>
          </span>
          <span className="text-theme-sm text-gray-500 dark:text-gray-400">
            Payment{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {order.payment_method === "midtrans" ? "Midtrans" : "Bank transfer"}
            </span>
          </span>
        </div>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          {statusHint(order)}
        </p>
        </div>
        {canWrite && (
          <TransitionBar order={order} onChanged={onChanged} onReload={onReload} />
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]">
        <div className="flex flex-col gap-6">
          <Section
            title="Order details"
            description="Snapshots from the catalog at the time of order."
          >
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
            {/* The summary sits in its own shaded panel so the total reads
                at a glance. */}
            <div className="ml-auto mt-5 w-full max-w-sm rounded-xl bg-gray-50 p-4 text-theme-sm sm:p-5 dark:bg-white/[0.03]">
              <p className="mb-3 font-medium text-gray-800 dark:text-white/90">
                Order summary
              </p>
              <dl className="grid gap-2.5">
                {(
                  [
                    ["Subtotal", order.subtotal],
                    ["Shipping", order.shipping],
                    ["Discount", -order.discount || 0],
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
                    {formatMoney(order.total)}
                  </dd>
                </div>
              </dl>
            </div>
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
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-base font-semibold text-gray-800 dark:text-white/90">
              Customer
            </h2>
            {/* The avatar is initials: customers have no photo in the API,
                the same as the customer page and the user menu. */}
            {/* Two columns: the avatar, then labelled name and phone beside
                it, divided between them. */}
            <div className="flex items-start gap-4">
              <div
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
              >
                {initialsOf(order.customer.name)}
              </div>
              <dl className="min-w-0 flex-1 divide-y divide-gray-100 text-theme-sm dark:divide-white/[0.05]">
                <DetailRow label="Name">
                  {order.customer_id ? (
                    <Link
                      href={`/customers/${order.customer_id}`}
                      className="font-medium hover:text-brand-500"
                    >
                      {order.customer.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{order.customer.name}</span>
                  )}
                </DetailRow>
                {order.customer.email && (
                  <DetailRow label="E-mail">{order.customer.email}</DetailRow>
                )}
                {order.customer.phone && (
                  <DetailRow label="Phone">{order.customer.phone}</DetailRow>
                )}
              </dl>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-base font-semibold text-gray-800 dark:text-white/90">
              Details
            </h2>
            <OrderProgress order={order} timezone={tz} />
            <dl className="mt-5 divide-y divide-gray-100 border-t border-gray-100 pt-4 text-theme-sm dark:divide-white/[0.05] dark:border-white/[0.05]">
              <DetailRow label="Source">
                {order.source === "manual"
                  ? "Manual order, created by your team"
                  : "Storefront, placed on your website"}
              </DetailRow>
              <DetailRow label="Payment">
                {order.payment_method === "midtrans" ? "Midtrans" : "Bank transfer"}
              </DetailRow>
              {order.shipping_courier && (
                <DetailRow label="Chosen courier">
                  {order.shipping_courier}
                  {order.shipping_service ? ` · ${order.shipping_service}` : ""}
                </DetailRow>
              )}
              {order.tracking_number && (
                <DetailRow label="Tracking">
                  {order.courier} {order.tracking_number}
                </DetailRow>
              )}
            </dl>
            {order.payments.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  Payment attempts
                </h3>
                {/* Newest first, as the API lists them (BR-123). */}
                <ul className="flex flex-col gap-2">
                  {order.payments.map((p) => (
                    <li
                      key={p.provider_order_id}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-theme-sm dark:border-gray-800"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-mono text-theme-xs">{p.provider_order_id}</span>
                        <span className="tabular-nums">{formatMoney(p.amount)}</span>
                      </div>
                      <div className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {paymentStatus[p.status]}
                        {p.transaction_status ? ` · Midtrans: ${p.transaction_status}` : ""}
                        {" · "}
                        {when(p.paid_at ?? p.created_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-1 text-base font-semibold text-gray-800 dark:text-white/90">
              History
            </h2>
            <p className="mb-4 text-theme-xs text-gray-500 dark:text-gray-400">
              Every change, newest first — who, what, when (BR-073).
            </p>
            {order.history.length === 0 ? (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Nothing has happened yet.
              </p>
            ) : (
              <ol>
                {order.history.map((h, i) => (
                  <HistoryItem
                    key={i}
                    entry={h}
                    last={i === order.history.length - 1}
                    tz={tz}
                  />
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </Page>
  )
}

/** Up to two initials, the same as the customer page and the user menu. */
function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** One label/value line of the Customer and Details cards. */
function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0 text-right text-gray-800 dark:text-white/90">
        {children}
      </dd>
    </div>
  )
}

/** The timeline icon for an audit entry: the stage it reached, else the act. */
const stageIcons: Record<string, LucideIcon> = {
  paid: BadgeCheck,
  processing: Package,
  shipped: Truck,
  completed: CheckCircle2,
  cancelled: Ban,
}

function historyIcon(h: OrderHistoryEntry): LucideIcon {
  if (h.to && stageIcons[h.to]) return stageIcons[h.to]
  if (h.action.includes("create")) return ShoppingCart
  if (h.action.includes("refund")) return Banknote
  return CircleDot
}

function HistoryItem({
  entry: h,
  last,
  tz,
}: {
  entry: OrderHistoryEntry
  last: boolean
  tz?: string
}) {
  const Icon = historyIcon(h)
  // The stage reached says enough: "Shipped", not "processing → shipped".
  const label = h.to ?? h.action.replace("order.", "")
  const title = label[0].toUpperCase() + label.slice(1)
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className="absolute bottom-0 left-[23px] top-12 border-l-2 border-dashed border-gray-300 dark:border-gray-700"
        />
      )}
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
        <div className="min-w-0 pt-0.5">
          <p className="text-base font-semibold text-gray-800 dark:text-white/90">
            {title}
          </p>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {h.actor?.name ?? "System"}
          </p>
        </div>
        <div
          className="shrink-0 pt-1 text-right text-theme-xs text-gray-500 dark:text-gray-400"
          title={formatRelative(h.created_at)}
        >
          <p>{formatTime(h.created_at, tz)}</p>
          <p>{formatDate(h.created_at, tz)}</p>
        </div>
      </div>
    </li>
  )
}
