import { Check } from "lucide-react"

import type { Order } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { cx } from "@/lib/utils"

type Step = {
  label: string
  at: string | null
  state: "done" | "current" | "upcoming" | "cancelled"
}

/** What the order is waiting for, in one line (the BR-070 flow). */
export function statusHint(order: Order): string {
  switch (order.status) {
    case "pending":
      return order.payment_method === "midtrans"
        ? "Waiting for the customer to pay through Midtrans."
        : "Waiting for the bank transfer. Mark it paid once the money arrives."
    case "paid":
      return "Paid. Start processing when you begin packing."
    case "processing":
      return "Being packed. Ship it with a courier and tracking number."
    case "shipped":
      return "On its way. Complete it once the customer has it."
    case "completed":
      return "Done. Nothing left to do."
    case "cancelled":
      if (order.refunded_at) return "Cancelled and refunded."
      return order.paid_at
        ? "Cancelled after payment. A refund is owed: record it once the money is sent back."
        : "Cancelled before payment."
  }
}

const flow = ["pending", "paid", "processing", "shipped", "completed"] as const

function steps(order: Order): Step[] {
  // Processing has no stamp of its own; its history entry has the time.
  const processedAt =
    order.history.find((h) => h.to === "processing")?.created_at ?? null
  const all = [
    { label: "Placed", at: order.placed_at },
    { label: "Paid", at: order.paid_at },
    { label: "Processing", at: processedAt },
    { label: "Shipped", at: order.shipped_at },
    { label: "Completed", at: order.completed_at },
  ]

  if (order.status === "cancelled") {
    // Only what it reached, then where it stopped.
    const reached: Step[] = all
      .filter((s) => s.at)
      .map((s) => ({ ...s, state: "done" }))
    reached.push({
      label: "Cancelled",
      at: order.cancelled_at,
      state: "cancelled",
    })
    if (order.refunded_at)
      reached.push({
        label: "Refund recorded",
        at: order.refunded_at,
        state: "done",
      })
    return reached
  }

  const current = flow.indexOf(order.status)
  return all.map((s, i) => ({
    ...s,
    state:
      i < current || order.status === "completed"
        ? "done"
        : i === current
          ? "current"
          : "upcoming",
  }))
}

/**
 * Where the order is in the BR-070 flow: every step with its date, the
 * current one ringed, the rest still to come. A cancelled order shows only
 * the steps it reached, then where it stopped.
 */
export function OrderProgress({
  order,
  timezone,
}: {
  order: Order
  timezone?: string
}) {
  const list = steps(order)
  return (
    <div>
      <ol aria-label="Order progress">
        {list.map((s, i) => (
          <li
            key={s.label}
            aria-current={s.state === "current" ? "step" : undefined}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            {i < list.length - 1 && (
              <span
                aria-hidden
                className={cx(
                  "absolute left-[9px] top-6 h-[calc(100%-1.25rem)] w-px",
                  s.state === "done"
                    ? "bg-brand-500"
                    : "bg-gray-200 dark:bg-gray-800",
                )}
              />
            )}
            <span
              aria-hidden
              className={cx(
                "relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                s.state === "done" && "bg-brand-500 text-white",
                s.state === "current" &&
                  "bg-white ring-2 ring-inset ring-brand-500 dark:bg-gray-900",
                s.state === "upcoming" &&
                  "bg-white ring-1 ring-inset ring-gray-300 dark:bg-gray-900 dark:ring-gray-700",
                s.state === "cancelled" && "bg-error-500 text-white",
              )}
            >
              {s.state === "done" && <Check className="size-3" />}
              {s.state === "current" && (
                <span className="size-2 rounded-full bg-brand-500" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 text-theme-sm">
              <span
                className={cx(
                  s.state === "upcoming"
                    ? "text-gray-400 dark:text-gray-500"
                    : "font-medium text-gray-800 dark:text-white/90",
                  s.state === "cancelled" &&
                    "text-error-600 dark:text-error-500",
                )}
              >
                {s.label}
                <span className="sr-only">
                  {s.state === "current"
                    ? " (current)"
                    : s.state === "upcoming"
                      ? " (not yet)"
                      : ""}
                </span>
              </span>
              {s.at && (
                <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                  {formatDateTime(s.at, timezone)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
