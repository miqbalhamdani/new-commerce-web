import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import CustomersPage from "@/app/(app)/customers/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

const replace = vi.fn()
vi.mock("next/navigation", () => ({
  usePathname: () => "/customers",
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(),
}))

beforeEach(() => vi.unstubAllGlobals())

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

    await userEvent.type(screen.getByLabelText("Search customers"), "rina{Enter}")
    expect(replace).toHaveBeenCalledWith("/customers?q=rina")
  })
})
