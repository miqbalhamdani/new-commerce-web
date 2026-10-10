import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import NewOrderPage from "@/app/(app)/orders/new/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => "/orders/new",
  useRouter: () => ({ push, replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

const product = { id: "p1", title: "Basic Tee" }
const variant = {
  id: "01a10000-0000-7000-8000-00000000000v",
  sku: "TEE-1",
  option_values: ["Black", "M"],
  price: 19900000,
  archived_at: null,
}

async function fillRequired() {
  await userEvent.type(await screen.findByLabelText("Name"), "Dewi")
  await userEvent.type(screen.getByLabelText("Address"), "Jl. Kenanga 4")
  await userEvent.type(screen.getByLabelText("City"), "Surabaya")
  await userEvent.type(screen.getByLabelText("Province"), "Jawa Timur")
  await userEvent.type(screen.getByLabelText("Postal code"), "60231")
  await userEvent.type(screen.getByLabelText("Search the catalog"), "tee{Enter}")
  await userEvent.click(await screen.findByRole("button", { name: "Basic Tee" }))
  await userEvent.click(
    await screen.findByRole("button", { name: /Black \/ M · TEE-1/ }),
  )
}

function catalogHandler(url: string) {
  if (url.includes("/v1/products?q=")) return json({ data: [product], next_cursor: null })
  if (url.endsWith("/v1/products/p1/variants")) return json({ data: [variant] })
  return undefined
}

describe("manual order entry (P1-110)", () => {
  it("prices from the catalog and sends only ids, qty and discount", async () => {
    let resolveCreate: (r: Response) => void = () => {}
    const fetchSpy = mockApi(["orders:read", "orders:write", "products:read"], (url, init) => {
      if (url.endsWith("/v1/orders") && init?.method === "POST") {
        // Answered manually below, so the in-flight state is observable.
        return undefined
      }
      return catalogHandler(url)
    })
    // Intercept the create call with a hand-rolled pending promise.
    const original = fetchSpy.getMockImplementation()!
    fetchSpy.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith("/v1/orders") && init?.method === "POST") {
        return new Promise<Response>((r) => {
          resolveCreate = r
        })
      }
      return original(input, init)
    })

    renderSignedIn(<NewOrderPage />)
    await fillRequired()
    expect(screen.getAllByText(/199,000/).length).toBeGreaterThan(0)

    const submit = screen.getByRole("button", { name: "Create order" })
    await userEvent.click(submit)
    // BR-078: disabled while the request is in flight.
    await waitFor(() => expect(submit).toBeDisabled())

    resolveCreate(json({ id: "o1" }, 201))
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orders/o1"))

    const call = fetchSpy.mock.calls.find(
      ([u, i]) => String(u).endsWith("/v1/orders") && i?.method === "POST",
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      source: "manual",
      customer: { name: "Dewi", email: null, phone: null },
      shipping_address: {
        line1: "Jl. Kenanga 4",
        line2: null,
        city: "Surabaya",
        province: "Jawa Timur",
        postal_code: "60231",
      },
      lines: [{ variant_id: variant.id, qty: 1 }],
    })
  })

  it("shows a 422 against its line", async () => {
    mockApi(["orders:read", "orders:write", "products:read"], (url, init) => {
      if (url.endsWith("/v1/orders") && init?.method === "POST")
        return json(
          {
            type: "https://docs.example.com/errors/validation_failed",
            title: "Validation failed",
            status: 422,
            trace_id: "t",
            errors: [
              { field: "lines.0.variant_id", detail: "This variant is archived." },
            ],
          },
          422,
        )
      return catalogHandler(url)
    })
    renderSignedIn(<NewOrderPage />)
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: "Create order" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This variant is archived.",
    )
  })

  it("cannot submit without a customer name or a line", async () => {
    mockApi(["orders:read", "orders:write", "products:read"], catalogHandler)
    renderSignedIn(<NewOrderPage />)
    expect(
      await screen.findByRole("button", { name: "Create order" }),
    ).toBeDisabled()
  })
})
