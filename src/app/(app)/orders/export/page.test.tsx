import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ExportPage from "@/app/(app)/orders/export/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

const replace = vi.fn()
let search = new URLSearchParams()
vi.mock("next/navigation", () => ({
  usePathname: () => "/orders/export",
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => search,
}))

beforeEach(() => {
  vi.unstubAllGlobals()
  replace.mockClear()
  search = new URLSearchParams()
})

describe("the order export (P1-112)", () => {
  it("starts a job with WIB offsets and puts the job id in the URL", async () => {
    search = new URLSearchParams("status=completed")
    const fetchSpy = mockApi(["exports:read", "orders:read"], (url, init) => {
      if (url.endsWith("/v1/orders/export") && init?.method === "POST")
        return json({ job_id: "j1" }, 202)
      return undefined
    })
    renderSignedIn(<ExportPage />)

    await userEvent.type(await screen.findByLabelText("Placed from"), "2026-09-01")
    await userEvent.type(screen.getByLabelText("Placed to"), "2026-10-01")
    await userEvent.click(screen.getByRole("button", { name: "Start export" }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/orders/export?job=j1"))
    const call = fetchSpy.mock.calls.find(([u]) =>
      String(u).endsWith("/v1/orders/export"),
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      status: ["completed"],
      placed_from: "2026-09-01T00:00:00+07:00",
      placed_to: "2026-10-01T23:59:59+07:00",
    })
  })

  it("polls to done and regenerates the link on demand", async () => {
    search = new URLSearchParams("job=j1")
    let reads = 0
    mockApi(["exports:read", "orders:read"], (url) => {
      if (url.endsWith("/v1/jobs/j1")) {
        reads++
        return json({
          id: "j1",
          kind: "order_export",
          state: reads === 1 ? "running" : "done",
          processed: 120,
          total: 120,
          failed: 0,
          created_at: "2026-10-10T12:00:00+07:00",
          finished_at: null,
          result:
            reads === 1
              ? null
              : { download_url: `https://files.example/x?sig=${reads}`, rows: 120, expires_in: 900 },
          error: null,
        })
      }
      return undefined
    })
    renderSignedIn(<ExportPage />)

    // sig=2 proves the hook polled past the running read before settling.
    expect(
      await screen.findByRole("link", { name: "Download CSV" }),
    ).toHaveAttribute("href", "https://files.example/x?sig=2")

    await userEvent.click(screen.getByRole("button", { name: "Get a new link" }))
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Download CSV" })).toHaveAttribute(
        "href",
        "https://files.example/x?sig=3",
      ),
    )
  })
})
