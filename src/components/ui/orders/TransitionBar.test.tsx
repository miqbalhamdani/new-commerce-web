import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TransitionBar } from "@/components/ui/orders/TransitionBar"
import type { Order } from "@/lib/api/types"
import { json, mockApi, renderSignedIn } from "@/test/api"

beforeEach(() => vi.unstubAllGlobals())

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: "01a10000-0000-7000-8000-000000000001",
    order_number: "ERG-000123",
    status: "processing",
    version: 3,
    shipping_courier: "jne",
    paid_at: "2026-10-06T17:02:00+07:00",
    refunded_at: null,
    allowed_transitions: ["shipped", "cancelled"],
    ...over,
  }) as Order

describe("TransitionBar (P1-109)", () => {
  it("offers exactly the allowed transitions", async () => {
    mockApi(["orders:write"], () => undefined)
    renderSignedIn(
      <TransitionBar order={order()} onChanged={vi.fn()} onReload={vi.fn()} />,
    )
    expect(
      await screen.findByRole("button", { name: "Ship order…" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Cancel order…" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Mark as paid" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Record refund…" }),
    ).not.toBeInTheDocument()
  })

  it("ships with the prefilled courier once a tracking number is typed", async () => {
    const fetchSpy = mockApi(["orders:write"], (url, init) => {
      if (url.endsWith("/ship") && init?.method === "POST")
        return json(order({ status: "shipped", allowed_transitions: ["completed"] }))
      return undefined
    })
    const onChanged = vi.fn()
    renderSignedIn(
      <TransitionBar order={order()} onChanged={onChanged} onReload={vi.fn()} />,
    )

    await userEvent.click(await screen.findByRole("button", { name: "Ship order…" }))
    const submit = screen.getByRole("button", { name: "Mark as shipped" })
    expect(submit).toBeDisabled()
    expect(screen.getByLabelText("Courier")).toHaveValue("jne")
    await userEvent.type(screen.getByLabelText("Tracking number"), "JNE0456")
    expect(submit).toBeEnabled()
    await userEvent.click(submit)

    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    const call = fetchSpy.mock.calls.find(([u]) => String(u).endsWith("/ship"))!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      courier: "jne",
      tracking_number: "JNE0456",
    })
  })

  it("a 409 says the order moved on and offers a reload", async () => {
    mockApi(["orders:write"], (url, init) => {
      if (url.endsWith("/complete") && init?.method === "POST")
        return json(
          {
            type: "https://docs.example.com/errors/illegal_transition",
            title: "Illegal transition",
            status: 409,
            trace_id: "t",
          },
          409,
        )
      return undefined
    })
    const onReload = vi.fn()
    renderSignedIn(
      <TransitionBar
        order={order({ status: "shipped", allowed_transitions: ["completed"] })}
        onChanged={vi.fn()}
        onReload={onReload}
      />,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Complete order" }),
    )
    await screen.findByText(/moved on since you loaded it/)
    await userEvent.click(screen.getByRole("button", { name: "Reload it" }))
    expect(onReload).toHaveBeenCalled()
  })

  it("records a refund on a cancelled, paid order", async () => {
    const fetchSpy = mockApi(["orders:write"], (url, init) => {
      if (url.endsWith("/refund") && init?.method === "POST")
        return json(order({ status: "cancelled", refunded_at: "2026-10-07T10:00:00+07:00" }))
      return undefined
    })
    renderSignedIn(
      <TransitionBar
        order={order({ status: "cancelled", allowed_transitions: [] })}
        onChanged={vi.fn()}
        onReload={vi.fn()}
      />,
    )
    await userEvent.click(
      await screen.findByRole("button", { name: "Record refund…" }),
    )
    await userEvent.type(screen.getByLabelText("Note"), "BCA transfer")
    await userEvent.click(screen.getByRole("button", { name: "Record refund" }))

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([u]) => String(u).endsWith("/refund"))
      expect(call).toBeTruthy()
      expect(JSON.parse(String(call![1]!.body))).toEqual({ note: "BCA transfer" })
    })
  })
})
