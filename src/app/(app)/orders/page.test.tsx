import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import OrdersPage from "@/app/(app)/orders/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

const replace = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => "/orders",
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(),
}))

beforeEach(() => vi.unstubAllGlobals())

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "01a10000-0000-7000-8000-000000000001",
  order_number: "ERG-000123",
  source: "storefront",
  status: "pending",
  version: 1,
  customer: { name: "Rina", email: "rina@example.com", phone: null },
  item_count: 2,
  total: 39800000,
  placed_at: "2026-10-06T16:15:00+07:00",
  paid_at: null,
  refunded_at: null,
  ...over,
})

describe("the order list (P1-108)", () => {
  it("renders the columns and the saved views", async () => {
    mockApi(["orders:read", "orders:write"], (url) => {
      if (url.includes("/v1/orders?")) return json({ data: [row()], next_cursor: null })
      return undefined
    })
    renderSignedIn(<OrdersPage />)

    expect(await screen.findByText("ERG-000123")).toBeInTheDocument()
    expect(screen.getByText("Rina")).toBeInTheDocument()
    expect(screen.getByText(/398,000/)).toBeInTheDocument()
    for (const label of [
      "All orders",
      "Awaiting payment",
      "Ready to ship",
      "Shipped",
      "Needs refund",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    // A clean URL is the All view.
    expect(screen.getByRole("button", { name: "All orders" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })

  it("sorts from the Placed header, newest first by default", async () => {
    mockApi(["orders:read"], (url) => {
      if (url.includes("/v1/orders?")) return json({ data: [row()], next_cursor: null })
      return undefined
    })
    renderSignedIn(<OrdersPage />)

    const header = (await screen.findByRole("button", { name: /Placed/ }))
      .closest("th")!
    expect(header).toHaveAttribute("aria-sort", "descending")
    await userEvent.click(screen.getByRole("button", { name: /Placed/ }))
    expect(replace).toHaveBeenLastCalledWith("/orders?sort=placed_at")
  })

  it("marks a pending order paid after a confirm", async () => {
    const fetchSpy = mockApi(["orders:read", "orders:write"], (url, init) => {
      if (url.endsWith("/mark-paid") && init?.method === "POST")
        return json(row({ status: "paid" }))
      if (url.includes("/v1/orders?")) return json({ data: [row()], next_cursor: null })
      return undefined
    })
    renderSignedIn(<OrdersPage />)

    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for ERG-000123" }),
    )
    await userEvent.click(await screen.findByText("Mark as paid"))
    await userEvent.click(screen.getByRole("button", { name: "Mark as paid" }))

    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/v1/orders/" + row().id + "/mark-paid") &&
            init?.method === "POST",
        ),
      ).toBe(true),
    )
  })

  it("cancels a paid order from the row menu after a confirm (BR-070)", async () => {
    const fetchSpy = mockApi(["orders:read", "orders:write"], (url, init) => {
      if (url.endsWith("/cancel") && init?.method === "POST")
        return json(row({ status: "cancelled" }))
      if (url.includes("/v1/orders?"))
        return json({ data: [row({ status: "paid" })], next_cursor: null })
      return undefined
    })
    renderSignedIn(<OrdersPage />)

    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for ERG-000123" }),
    )
    await userEvent.click(await screen.findByText("Cancel order"))
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel order" }),
    )

    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/v1/orders/" + row().id + "/cancel") &&
            init?.method === "POST",
        ),
      ).toBe(true),
    )
  })

  it("offers no cancel once an order has shipped (BR-070)", async () => {
    mockApi(["orders:read", "orders:write"], (url) => {
      if (url.includes("/v1/orders?"))
        return json({ data: [row({ status: "shipped" })], next_cursor: null })
      return undefined
    })
    renderSignedIn(<OrdersPage />)

    await screen.findByText("ERG-000123")
    expect(
      screen.queryByRole("button", { name: /Actions for/ }),
    ).not.toBeInTheDocument()
  })

  it("offers no actions without orders:write", async () => {
    mockApi(["orders:read"], (url) => {
      if (url.includes("/v1/orders?")) return json({ data: [row()], next_cursor: null })
      return undefined
    })
    renderSignedIn(<OrdersPage />)

    await screen.findByText("ERG-000123")
    expect(
      screen.queryByRole("button", { name: /Actions for/ }),
    ).not.toBeInTheDocument()
  })
})
