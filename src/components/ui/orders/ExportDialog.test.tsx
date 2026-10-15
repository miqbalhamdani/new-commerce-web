import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ExportDialog } from "@/components/ui/orders/ExportDialog"
import { filtersFromQuery } from "@/lib/orders/filters"
import { json, mockApi, renderSignedIn } from "@/test/api"

beforeEach(() => {
  vi.unstubAllGlobals()
})

const seed = (q = "") => filtersFromQuery(new URLSearchParams(q))

describe("the order export (P1-112)", () => {
  it("starts a job with WIB offsets, seeded from the list's filters", async () => {
    const fetchSpy = mockApi(["exports:read", "orders:read"], (url, init) => {
      if (url.endsWith("/v1/orders/export") && init?.method === "POST")
        return json({ job_id: "j1" }, 202)
      return undefined
    })
    renderSignedIn(
      <ExportDialog seed={seed("status=completed")} onClose={vi.fn()} />,
    )

    await userEvent.type(
      await screen.findByLabelText("Placed from"),
      "2026-09-01",
    )
    await userEvent.type(screen.getByLabelText("Placed to"), "2026-10-01")
    await userEvent.click(screen.getByRole("button", { name: "Start export" }))

    expect(
      await screen.findByRole("button", { name: "Start a new export" }),
    ).toBeInTheDocument()
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
    let reads = 0
    mockApi(["exports:read", "orders:read"], (url, init) => {
      if (url.endsWith("/v1/orders/export") && init?.method === "POST")
        return json({ job_id: "j1" }, 202)
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
              : {
                  download_url: `https://files.example/x?sig=${reads}`,
                  rows: 120,
                  expires_in: 900,
                },
          error: null,
        })
      }
      return undefined
    })
    renderSignedIn(<ExportDialog seed={seed()} onClose={vi.fn()} />)
    await userEvent.click(
      await screen.findByRole("button", { name: "Start export" }),
    )

    // sig=2 proves the hook polled past the running read before settling.
    expect(
      await screen.findByRole(
        "link",
        { name: "Download CSV" },
        { timeout: 3000 },
      ),
    ).toHaveAttribute("href", "https://files.example/x?sig=2")

    await userEvent.click(
      screen.getByRole("button", { name: "Get a new link" }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Download CSV" }),
      ).toHaveAttribute("href", "https://files.example/x?sig=3"),
    )
  })
})
