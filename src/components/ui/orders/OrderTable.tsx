"use client"

import { ArrowDown, ArrowUp, BadgeCheck, Ban } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  Table,
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
import { RowMenu } from "@/components/ui/common/RowMenu"
import {
  OrderSourceBadge,
  OrderStatusBadge,
} from "@/components/ui/orders/OrderStatusBadge"
import type { OrderListRow } from "@/lib/api/types"
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format"

/**
 * The order list's table (P1-108), reused by the customer detail (P1-111)
 * without the action handlers. A row opens the order. "Mark as paid" appears
 * only on pending rows when the handler is passed -- pending → paid is always
 * legal (BR-070) and a repeat is a harmless no-op (BR-071). "Cancel order"
 * appears on pending, paid and processing rows, the only statuses BR-070
 * cancels from; a stale row 409s and the dialog says so. `bare` drops the
 * bordered shell for a table that sits directly in its own card. With
 * `onSort`, the Placed header sorts: the only order the API offers (§5.1).
 */
export function OrderTable({
  rows,
  timezone,
  onMarkPaid,
  onCancel,
  bare,
  sort,
  onSort,
}: {
  rows: OrderListRow[]
  timezone?: string
  onMarkPaid?: (o: OrderListRow) => void
  onCancel?: (o: OrderListRow) => void
  bare?: boolean
  sort?: "-placed_at" | "placed_at"
  onSort?: () => void
}) {
  const router = useRouter()
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const hasActions = Boolean(onMarkPaid || onCancel)
  const Shell = bare ? BareShell : ListTable
  return (
    <Shell>
      <TableHeader className={headerRow}>
        <TableRow>
          <TableCell isHeader className={th}>
            Order
          </TableCell>
          <TableCell isHeader className={th}>
            Source
          </TableCell>
          <TableCell isHeader className={th}>
            Customer
          </TableCell>
          <TableCell isHeader className={`${th} text-right`}>
            Items
          </TableCell>
          <TableCell isHeader className={`${th} text-right`}>
            Total
          </TableCell>
          <TableCell isHeader className={th}>
            Status
          </TableCell>
          {/* A plain th: the vendored TableCell drops aria-sort. */}
          <th
            className={th}
            aria-sort={
              onSort
                ? sort === "placed_at"
                  ? "ascending"
                  : "descending"
                : undefined
            }
          >
            {onSort ? (
              <button
                type="button"
                onClick={onSort}
                className="-mx-1 inline-flex items-center gap-1 rounded px-1 font-medium hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:text-white/90"
              >
                Placed
                {sort === "placed_at" ? (
                  <ArrowUp aria-hidden className="size-3.5" />
                ) : (
                  <ArrowDown aria-hidden className="size-3.5" />
                )}
                <span className="sr-only">
                  {sort === "placed_at"
                    ? ", oldest first. Sort newest first"
                    : ", newest first. Sort oldest first"}
                </span>
              </button>
            ) : (
              "Placed"
            )}
          </th>
          {hasActions && (
            <TableCell isHeader className={`${th} w-px`}>
              <span className="sr-only">Actions</span>
            </TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className={bodyRows}>
        {rows.map((o) => (
          <TableRow
            key={o.id}
            onClick={() => router.push(`/orders/${o.id}`)}
            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
          >
            <TableCell className={td}>
              <Link
                href={`/orders/${o.id}`}
                onClick={stop}
                className="whitespace-nowrap font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
              >
                {o.order_number}
              </Link>
            </TableCell>
            <TableCell className={td}>
              <OrderSourceBadge source={o.source} />
            </TableCell>
            <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
              {o.customer.name}
            </TableCell>
            <TableCell
              className={`${td} text-right tabular-nums text-gray-500 dark:text-gray-400`}
            >
              {o.item_count}
            </TableCell>
            <TableCell
              className={`${td} text-right tabular-nums text-gray-500 dark:text-gray-400`}
            >
              {formatMoney(o.total)}
            </TableCell>
            <TableCell className={td}>
              <OrderStatusBadge status={o.status} />
            </TableCell>
            <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
              <span title={formatDateTime(o.placed_at, timezone)}>
                {formatRelative(o.placed_at)}
              </span>
            </TableCell>
            {hasActions && (
              <TableCell className={`${td} !py-2 text-right`}>
                <RowActions order={o} onMarkPaid={onMarkPaid} onCancel={onCancel} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Shell>
  )
}

function BareShell({ children }: { children: React.ReactNode }) {
  // The header band needs a line above it too when no shell border draws one.
  return (
    <div className="max-w-full overflow-x-auto border-t border-gray-100 dark:border-white/[0.05]">
      <Table>{children}</Table>
    </div>
  )
}

/** BR-070: cancelled is reachable only from these. */
const cancellable: readonly string[] = ["pending", "paid", "processing"]

function RowActions({
  order: o,
  onMarkPaid,
  onCancel,
}: {
  order: OrderListRow
  onMarkPaid?: (o: OrderListRow) => void
  onCancel?: (o: OrderListRow) => void
}) {
  const actions = [
    ...(onMarkPaid && o.status === "pending"
      ? [
          {
            label: "Mark as paid",
            icon: <BadgeCheck />,
            onSelect: () => onMarkPaid(o),
          },
        ]
      : []),
    ...(onCancel && cancellable.includes(o.status)
      ? [
          {
            label: "Cancel order",
            icon: <Ban />,
            destructive: true,
            onSelect: () => onCancel(o),
          },
        ]
      : []),
  ]
  if (actions.length === 0) return null
  return <RowMenu label={`Actions for ${o.order_number}`} actions={actions} />
}
