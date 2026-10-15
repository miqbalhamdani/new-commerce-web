import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { OrderProgress, statusHint } from "@/components/ui/orders/OrderProgress"
import type { Order } from "@/lib/api/types"

const base = {
  status: "pending",
  payment_method: "bank_transfer",
  placed_at: "2026-10-06T10:00:00+07:00",
  paid_at: null,
  shipped_at: null,
  completed_at: null,
  cancelled_at: null,
  refunded_at: null,
  history: [],
} as unknown as Order

const order = (over: Partial<Order>) => ({ ...base, ...over }) as Order

function stepNames() {
  const list = screen.getByRole("list", { name: "Order progress" })
  return within(list)
    .getAllByRole("listitem")
    .map((li) => li.textContent)
}

describe("the order progress (BR-070)", () => {
  it("rings the current step and leaves the rest to come", () => {
    render(
      <OrderProgress
        order={order({
          status: "shipped",
          paid_at: "2026-10-06T11:00:00+07:00",
          shipped_at: "2026-10-07T09:00:00+07:00",
          history: [
            {
              actor: null,
              action: "order.transition",
              from: "paid",
              to: "processing",
              created_at: "2026-10-06T15:00:00+07:00",
            },
          ],
        })}
      />,
    )
    const names = stepNames()
    expect(names.map((n) => n?.split(/\d/)[0])).toEqual([
      "Placed",
      "Paid",
      "Processing",
      "Shipped (current)",
      "Completed (not yet)",
    ])
    // Processing has no stamp; its time comes from the history entry.
    expect(names[2]).toMatch(/\d/)
  })

  it("shows only the steps a cancelled order reached, then where it stopped", () => {
    const cancelled = order({
      status: "cancelled",
      paid_at: "2026-10-06T11:00:00+07:00",
      cancelled_at: "2026-10-07T09:00:00+07:00",
    })
    render(<OrderProgress order={cancelled} />)
    expect(stepNames().map((n) => n?.split(/\d/)[0])).toEqual([
      "Placed",
      "Paid",
      "Cancelled",
    ])
    expect(statusHint(cancelled)).toMatch(/refund is owed/)
  })

  it("says what a pending order waits for, by payment method", () => {
    expect(statusHint(base)).toMatch(/bank transfer/)
    expect(statusHint(order({ payment_method: "midtrans" }))).toMatch(
      /Midtrans/,
    )
  })
})
