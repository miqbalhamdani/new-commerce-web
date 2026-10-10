import Badge from "@/components/ui/badge/Badge"
import type { OrderListRow, OrderStatus } from "@/lib/api/types"

// One map for every screen: warning = needs action, success = the ops goal,
// light = terminal and needs nothing, error = cancelled.
const statusColor = {
  pending: "warning",
  paid: "primary",
  processing: "info",
  shipped: "success",
  completed: "light",
  cancelled: "error",
} as const

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge size="sm" color={statusColor[status]}>
      {status}
    </Badge>
  )
}

export function OrderSourceBadge({ source }: { source: OrderListRow["source"] }) {
  return (
    <Badge size="sm" color={source === "manual" ? "info" : "light"}>
      {source}
    </Badge>
  )
}
