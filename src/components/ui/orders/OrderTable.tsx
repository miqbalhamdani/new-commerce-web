"use client"

import { BadgeCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
import { RowMenu } from "@/components/ui/common/RowMenu"
import {
  OrderSourceBadge,
  OrderStatusBadge,
} from "@/components/ui/orders/OrderStatusBadge"
import type { OrderListRow } from "@/lib/api/types"
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format"

/**
 * The order list's table (P1-108), reused by the customer detail (P1-111)
 * without onMarkPaid. A row opens the order; "Mark as paid" appears only on
 * pending rows when the handler is passed -- pending → paid is always legal
 * (BR-070) and a repeat is a harmless no-op (BR-071).
 */
export function OrderTable({
  rows,
  timezone,
  onMarkPaid,
}: {
  rows: OrderListRow[]
  timezone?: string
  onMarkPaid?: (o: OrderListRow) => void
}) {
  const router = useRouter()
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  return (
    <ListTable>
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
          <TableCell isHeader className={th}>
            Placed
          </TableCell>
          {onMarkPaid && (
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
                className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
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
            {onMarkPaid && (
              <TableCell className={`${td} !py-2 text-right`}>
                {o.status === "pending" && (
                  <RowMenu
                    label={`Actions for ${o.order_number}`}
                    actions={[
                      {
                        label: "Mark as paid",
                        icon: <BadgeCheck />,
                        onSelect: () => onMarkPaid(o),
                      },
                    ]}
                  />
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </ListTable>
  )
}
