import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Suspense } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import CustomerPage from "@/app/(app)/customers/[id]/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

vi.mock("next/navigation", () => ({
  usePathname: () => "/customers/c1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

const rina = {
  id: "c1",
  name: "Rina",
  email: "rina@example.com",
  phone: "+628123",
  order_count: 0,
  created_at: "2026-10-06T16:15:00+07:00",
  purged_at: null,
  orders: [],
}
const purged = {
  ...rina,
  name: "Deleted customer",
  email: "purged+c1@invalid",
  phone: null,
  purged_at: "2026-10-12T23:00:00+07:00",
}

// A promise React's use() can read at once (see orders/[id]/page.test.tsx).
const params = Object.assign(Promise.resolve({ id: "c1" }), {
  status: "fulfilled",
  value: { id: "c1" },
})

function render() {
  renderSignedIn(
    <Suspense>
      <CustomerPage params={params} />
    </Suspense>,
  )
}

describe("deleting a customer's personal data (P1-215)", () => {
  it("is the owner's: confirm, wait for the job, then show the erased customer", async () => {
    let done = false
    const spy = mockApi(
      ["customers:read", "customers:purge"],
      (url, init) => {
        if (url.endsWith("/v1/customers/c1/purge") && init?.method === "POST")
          return json({ job_id: "j1" }, 202)
        if (url.endsWith("/v1/jobs/j1")) {
          done = true
          return json({
            id: "j1",
            kind: "customer_purge",
            state: "done",
            result: { orders: 2 },
          })
        }
        if (url.endsWith("/v1/customers/c1")) return json(done ? purged : rina)
        return undefined
      },
      "owner",
    )
    render()

    await userEvent.click(
      await screen.findByRole("button", { name: "Delete personal data" }),
    )
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveTextContent("can't be undone")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete personal data" }),
    )

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Personal data deleted",
    )
    expect(screen.getByText("Deleted customer")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Delete personal data" }),
    ).not.toBeInTheDocument()
    // One purge, with no body: the route takes none.
    const purges = spy.mock.calls.filter(([url]) =>
      String(url).endsWith("/purge"),
    )
    expect(purges).toHaveLength(1)
    expect(purges[0][1]?.body).toBeUndefined()
  })

  it("is not offered to an admin (BR-025)", async () => {
    mockApi(["customers:read"], (url) =>
      url.endsWith("/v1/customers/c1") ? json(rina) : undefined,
    )
    render()

    expect(await screen.findByText("rina@example.com")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Delete personal data" }),
    ).not.toBeInTheDocument()
  })
})
