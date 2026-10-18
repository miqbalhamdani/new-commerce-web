import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import CustomersPage from "@/app/(app)/customers/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

const replace = vi.fn()
const nav = vi.hoisted(() => ({ search: "" }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/customers",
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))

beforeEach(() => {
  vi.unstubAllGlobals()
  nav.search = ""
})

const customer = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@example.com`,
  phone: null,
  order_count: 0,
  created_at: "2026-10-06T16:15:00+07:00",
})

describe("the customer list (P1-111)", () => {
  it("renders rows and searches on Enter", async () => {
    mockApi(["customers:read"], (url) => {
      if (url.includes("/v1/customers?"))
        return json({
          data: [
            {
              id: "c1",
              name: "Rina",
              email: "rina@example.com",
              phone: "+628123",
              order_count: 3,
              created_at: "2026-10-06T16:15:00+07:00",
            },
          ],
          next_cursor: null,
        })
      return undefined
    })
    renderSignedIn(<CustomersPage />)

    expect(await screen.findByText("Rina")).toBeInTheDocument()
    expect(screen.getByText("rina@example.com")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()

    await userEvent.type(
      screen.getByLabelText("Search customers"),
      "rina{Enter}",
    )
    expect(replace).toHaveBeenCalledWith("/customers?q=rina")
  })

  it("asks for the URL's page and pages by number (P1-232)", async () => {
    nav.search = "q=a&page=2"
    const asked: string[] = []
    mockApi(["customers:read"], (url) => {
      if (!url.includes("/v1/customers?")) return undefined
      asked.push(url)
      return json({
        data: [customer("c51", "Ayu")],
        next_cursor: null,
        total: 120,
      })
    })
    renderSignedIn(<CustomersPage />)

    expect(
      await screen.findByText("51–100 of 120 customers"),
    ).toBeInTheDocument()
    expect(asked.at(-1)).toContain("page=2")

    await userEvent.click(screen.getByRole("button", { name: "Page 3" }))
    expect(replace).toHaveBeenCalledWith("/customers?q=a&page=3")
    await userEvent.click(screen.getByRole("button", { name: "Page 1" }))
    expect(replace).toHaveBeenCalledWith("/customers?q=a")
  })
})
