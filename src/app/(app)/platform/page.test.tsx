import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import PlatformPage from "@/app/(app)/platform/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

vi.mock("next/navigation", () => ({
  usePathname: () => "/platform",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

const now = new Date().toISOString()
const longAgo = "2026-01-01T09:00:00+07:00"

const shop = (
  id: string,
  name: string,
  over: Record<string, unknown> = {},
) => ({
  id,
  name,
  slug: id,
  status: "active",
  created_at: now,
  source: "email",
  owner: {
    name: `${name} owner`,
    email: `${id}@example.com`,
    status: "active",
    last_login_at: now,
  },
  website: { theme: "katalog", logo: true, whatsapp: false, set_up: true },
  products: { active: 3, total: 4, first_at: now },
  orders: { total: 1, last_30d: 1, first_at: now, last_at: now },
  last_activity_at: now,
  ...over,
})

const report = {
  generated_at: now,
  summary: {
    shops: 3,
    new_7d: 2,
    new_30d: 3,
    verified: 2,
    website_set_up: 1,
    with_products: 1,
    with_orders: 1,
    active_7d: 1,
    sleeping: 1,
  },
  shops: [
    shop("lelap", "Lelap"),
    shop("kirana", "Kirana", {
      owner: {
        name: "Rina",
        email: "rina@kirana.id",
        status: "invited",
        last_login_at: null,
      },
      last_activity_at: null,
    }),
    shop("seruni", "Seruni", { last_activity_at: longAgo }),
    shop("sahira", "Sahira", { source: "cli" }),
  ],
}

const rows = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0].textContent)

describe("the platform page (P1-903, BR-150)", () => {
  it("is not there for anyone but a platform admin", async () => {
    const spy = mockApi(["orders:read"], () => undefined, "owner")
    renderSignedIn(<PlatformPage />)
    expect(
      await screen.findByText("You don't have access to the platform page."),
    ).toBeTruthy()
    expect(
      spy.mock.calls.some(([u]) => String(u).includes("/v1/platform")),
    ).toBe(false)
  })

  it("shows the summary, the funnel and the shops, CLI shops hidden", async () => {
    mockApi(
      [],
      (url) => (url.endsWith("/v1/platform/shops") ? json(report) : undefined),
      "owner",
      true,
    )
    renderSignedIn(<PlatformPage />)
    await screen.findByText("Signup funnel")
    expect(screen.getByText("2 this week · 3 in 30 days")).toBeTruthy()
    expect(screen.getByText("Got an order")).toBeTruthy()
    expect(rows().map((r) => r?.replace(/\..*$/, ""))).toEqual([
      "Lelaplelap",
      "Kiranakirana",
      "Seruniseruni",
    ])
    expect(
      screen.getByRole("link", { name: "Lelap" }).getAttribute("href"),
    ).toBe("https://lelap.belli.id")
  })

  it("filters by not verified, sleeping, search and the CLI toggle", async () => {
    mockApi(
      [],
      (url) => (url.endsWith("/v1/platform/shops") ? json(report) : undefined),
      "owner",
      true,
    )
    renderSignedIn(<PlatformPage />)
    await screen.findByText("Signup funnel")
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Not verified" }))
    expect(rows()).toHaveLength(1)
    expect(screen.getByText("rina@kirana.id")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Sleeping" }))
    expect(rows()).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Seruni" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "All" }))
    await user.type(screen.getByLabelText("Search shops"), "lelap@")
    expect(rows()).toHaveLength(1)

    await user.clear(screen.getByLabelText("Search shops"))
    await user.click(screen.getByRole("switch", { name: "CLI and demo shops" }))
    expect(rows()).toHaveLength(4)
  })
})
