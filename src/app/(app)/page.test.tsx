import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Dashboard } from "@/lib/api/types"
import { periodRange } from "@/lib/dashboard/period"
import { json, mockApi, renderSignedIn } from "@/test/api"

import DashboardPage from "./page"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
// The chart library draws with browser layout jsdom does not have; the
// figures it would draw are asserted through the table view instead.
vi.mock("react-apexcharts", () => ({ default: () => null }))

const day = (date: string, sales: number, orders: number) => ({
  date,
  sales,
  orders,
})

const dashboard: Dashboard = {
  from: "2026-09-19T00:00:00+07:00",
  to: "2026-10-19T00:00:00+07:00",
  needs_action: {
    awaiting_payment: 2,
    transfers_to_confirm: 3,
    ready_to_ship: 4,
    shipped: 6,
    refund_owed: 1,
  },
  current: {
    sales: 125400000,
    orders: 41,
    average_order_value: 3058536,
    items_sold: 77,
  },
  previous: {
    sales: 104500000,
    orders: 41,
    average_order_value: 2780487,
    items_sold: 0,
  },
  daily: [day("2026-10-17", 39800000, 1), day("2026-10-18", 0, 0)],
  by_source: [
    { source: "manual", sales: 75240000, orders: 27 },
    { source: "storefront", sales: 50160000, orders: 14 },
  ],
  by_payment_method: [
    { payment_method: "bank_transfer", sales: 125400000, orders: 41 },
    { payment_method: "midtrans", sales: 0, orders: 0 },
  ],
  customers: { new: 12, returning: 19 },
  top_products: [
    {
      product_id: "p1",
      title: "Erigo Basic Tee",
      items_sold: 18,
      sales: 35900000,
    },
  ],
}

const latest = {
  data: [
    {
      id: "o1",
      order_number: "ERG-000123",
      source: "manual",
      status: "paid",
      version: 2,
      customer: { name: "Rina", email: null, phone: null },
      item_count: 2,
      total: 39800000,
      placed_at: "2026-10-18T09:00:00+07:00",
      paid_at: "2026-10-18T09:30:00+07:00",
      refunded_at: null,
    },
  ],
  next_cursor: null,
  total: 1,
}

function serve() {
  return mockApi(["orders:read"], (url) => {
    if (url.includes("/v1/dashboard?")) return json(dashboard)
    if (url.includes("/v1/orders?limit=5")) return json(latest)
    return undefined
  })
}

beforeEach(() => vi.unstubAllGlobals())

describe("the dashboard (P1-114)", () => {
  it("opens each needs-action count's saved view", async () => {
    serve()
    renderSignedIn(<DashboardPage />)
    const tiles = within(
      await screen.findByRole("region", { name: "Needs action" }),
    )
    // Pending is both payment methods together; the bank transfers are the ones staff confirm.
    const pending = tiles.getByRole("link", { name: /Awaiting payment/ })
    expect(pending).toHaveAttribute("href", "/orders?status=pending")
    expect(pending).toHaveTextContent("5")
    expect(pending).toHaveTextContent("3 bank transfers to confirm")
    expect(tiles.getByRole("link", { name: /Ready to ship/ })).toHaveAttribute(
      "href",
      "/orders?status=paid&status=processing",
    )
    expect(tiles.getByRole("link", { name: /Shipped/ })).toHaveAttribute(
      "href",
      "/orders?status=shipped",
    )
    expect(tiles.getByRole("link", { name: /Needs refund/ })).toHaveAttribute(
      "href",
      "/orders?refund_owed=true",
    )
  })

  it("shows the period against the one before, the splits, top products and the latest orders", async () => {
    serve()
    renderSignedIn(<DashboardPage />)
    expect(await screen.findByText("Rp 1,254,000")).toBeInTheDocument()
    // 1,254,000 against 1,045,000 is +20%; orders are level; the average is
    // up 10%; items had nothing before.
    expect(screen.getByText("+20%")).toBeInTheDocument()
    expect(screen.getByText("+10%")).toBeInTheDocument()
    expect(screen.getByText("+0%")).toBeInTheDocument()
    expect(
      screen.getByText("Nothing in the previous 30 days to compare with"),
    ).toBeInTheDocument()

    const channel = screen.getByRole("img", { name: /^Sales by channel/ })
    expect(channel).toHaveAccessibleName(
      "Sales by channel: WhatsApp & manual 60%, Website 40%",
    )
    expect(screen.getByText(/Rp 752,400 · 27 orders/)).toBeInTheDocument()
    expect(
      screen.getByRole("img", { name: /^Customers/ }),
    ).toHaveAccessibleName("Customers: New 39%, Returning 61%")

    expect(
      screen.getByRole("link", { name: "Erigo Basic Tee" }),
    ).toHaveAttribute("href", "/products/p1")
    expect(await screen.findByText("ERG-000123")).toBeInTheDocument()

    // The chart's figures, every day of them, are in its table.
    const table = screen.getByText("Show as a table").closest("details")!
    expect(within(table).getByText("17 Oct")).toBeInTheDocument()
    expect(within(table).getByText("Rp 398,000")).toBeInTheDocument()
  })

  it("asks again for the period chosen", async () => {
    const fetch = serve()
    renderSignedIn(<DashboardPage />)
    await screen.findByText("Rp 1,254,000")
    const month = periodRange(30)
    expect(
      fetch.mock.calls.some(([u]) =>
        String(u).endsWith(`/v1/dashboard?from=${month.from}&to=${month.to}`),
      ),
    ).toBe(true)
    await userEvent.click(screen.getByRole("button", { name: "7 days" }))
    const week = periodRange(7)
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([u]) =>
          String(u).endsWith(`/v1/dashboard?from=${week.from}&to=${week.to}`),
        ),
      ).toBe(true),
    )
    expect(screen.getByRole("button", { name: "7 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("asks for nothing without orders:read", async () => {
    const fetch = mockApi(["products:read"], () => undefined)
    renderSignedIn(<DashboardPage />)
    expect(
      await screen.findByText("You don't have access to orders."),
    ).toBeInTheDocument()
    expect(
      fetch.mock.calls.some(([u]) => String(u).includes("/v1/dashboard")),
    ).toBe(false)
  })
})
