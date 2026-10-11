import { screen, within } from "@testing-library/react"
import { Suspense } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import OrderPage from "@/app/(app)/orders/[id]/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders/o1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

const order = {
  id: "o1",
  order_number: "ERG-000123",
  source: "storefront",
  status: "pending",
  version: 1,
  customer_id: null,
  customer: { name: "Rina", email: "rina@example.com", phone: null },
  shipping_address: {
    line1: "Jl. Melati 12",
    line2: null,
    city: "Bandung",
    province: "Jawa Barat",
    postal_code: "40115",
  },
  note: null,
  lines: [],
  subtotal: 21900000,
  shipping: 1100000,
  discount: 0,
  total: 23000000,
  payment_method: "midtrans",
  payments: [
    {
      provider_order_id: "ERG-000123-2",
      status: "pending",
      transaction_status: "pending",
      amount: 23000000,
      paid_at: null,
      created_at: "2026-10-07T09:00:00+07:00",
    },
    {
      provider_order_id: "ERG-000123",
      status: "failed",
      transaction_status: "expire",
      amount: 23000000,
      paid_at: null,
      created_at: "2026-10-06T16:15:00+07:00",
    },
  ],
  shipping_courier: "jne",
  shipping_service: "reg",
  courier: null,
  tracking_number: null,
  allowed_transitions: ["paid", "cancelled"],
  history: [],
  placed_at: "2026-10-06T16:15:00+07:00",
  paid_at: null,
  shipped_at: null,
  completed_at: null,
  cancelled_at: null,
  refunded_at: null,
}

// A promise React's use() can read at once: already marked fulfilled, the way
// React marks one it has seen settle.
const params = Object.assign(Promise.resolve({ id: "o1" }), {
  status: "fulfilled",
  value: { id: "o1" },
})

describe("the order detail (P1-229)", () => {
  it("lists Midtrans attempts newest first, and the courier the shopper chose", async () => {
    mockApi(["orders:read", "orders:write"], (url) => {
      if (url.endsWith("/v1/orders/o1")) return json(order)
      return undefined
    })
    renderSignedIn(
      <Suspense>
        <OrderPage params={params} />
      </Suspense>,
    )

    const heading = await screen.findByText("Payment attempts")
    const list = within(heading.parentElement as HTMLElement).getAllByRole(
      "listitem",
    )
    expect(list[0]).toHaveTextContent("ERG-000123-2")
    expect(list[0]).toHaveTextContent("Waiting for payment")
    expect(list[1]).toHaveTextContent("Failed or expired · Midtrans: expire")
    expect(screen.getByText("jne · reg")).toBeInTheDocument()
  })
})
