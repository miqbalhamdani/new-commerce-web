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

export function OrderStatusBadge({
  status,
  size = "sm",
}: {
  status: OrderStatus
  /** "md" for the detail header; tables stay "sm". */
  size?: "sm" | "md"
}) {
  return (
    <Badge size={size} color={statusColor[status]}>
      {status[0].toUpperCase() + status.slice(1)}
    </Badge>
  )
}

export function OrderSourceBadge({
  source,
  size = "sm",
}: {
  source: OrderListRow["source"]
  size?: "sm" | "md"
}) {
  return (
    <Badge size={size} color={source === "manual" ? "info" : "light"}>
      {source[0].toUpperCase() + source.slice(1)}
    </Badge>
  )
}
