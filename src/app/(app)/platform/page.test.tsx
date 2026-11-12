import { screen, waitFor, within } from "@testing-library/react"
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

describe("the platform shop actions (P1-916, BR-151)", () => {
  const sent = (
    spy: ReturnType<typeof mockApi>,
    path: string,
    method: string,
  ) =>
    spy.mock.calls.find(
      ([u, i]) => String(u).endsWith(path) && i?.method === method,
    )

  function platformApi(
    over: (url: string, init?: RequestInit) => Response | undefined,
  ) {
    return mockApi(
      [],
      (url, init) =>
        over(url, init) ??
        (url.endsWith("/v1/platform/shops") ? json(report) : undefined),
      "owner",
      true,
    )
  }

  it("opens a held shop, and shows a taken email on its field", async () => {
    let calls = 0
    const spy = platformApi((url, init) => {
      if (!url.endsWith("/v1/platform/shops") || init?.method !== "POST")
        return undefined
      calls++
      return calls === 1
        ? json(
            {
              type: "about:blank",
              title: "Validation failed",
              status: 422,
              detail: "taken",
              errors: [
                {
                  field: "owner_email",
                  detail: "This email already has an account in a shop.",
                },
              ],
              trace_id: "t",
            },
            422,
          )
        : json(shop("baru", "Toko Baru", { source: "platform" }), 201)
    })
    renderSignedIn(<PlatformPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "New shop" }))
    const dialog = screen.getByRole("dialog")
    await user.type(within(dialog).getByLabelText("Shop name"), "Toko Baru")
    await user.type(within(dialog).getByLabelText("Owner's name"), "Rina")
    await user.type(
      within(dialog).getByLabelText("Owner's email"),
      "rina@lelap.id",
    )
    await user.click(within(dialog).getByRole("button", { name: "Open shop" }))
    expect(
      await within(dialog).findByText(
        "This email already has an account in a shop.",
      ),
    ).toBeTruthy()

    await user.click(within(dialog).getByRole("button", { name: "Open shop" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(
      JSON.parse(String(sent(spy, "/v1/platform/shops", "POST")?.[1]?.body)),
    ).toEqual({
      shop_name: "Toko Baru",
      owner_name: "Rina",
      owner_email: "rina@lelap.id",
      send_invite: false,
    })
  })

  it("sends the invite and changes the owner only while invited", async () => {
    const spy = platformApi((url, init) => {
      if (url.endsWith("/kirana/invite"))
        return new Response(null, { status: 204 })
      if (url.endsWith("/kirana/owner") && init?.method === "PATCH")
        return json(shop("kirana", "Kirana"))
      return undefined
    })
    renderSignedIn(<PlatformPage />)
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", { name: "Actions for Lelap" }),
    )
    expect(screen.queryByRole("menuitem", { name: "Send invite" })).toBeNull()
    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Actions for Kirana" }))
    await user.click(screen.getByRole("menuitem", { name: "Send invite" }))
    expect(
      await screen.findByText("Invite sent to rina@kirana.id."),
    ).toBeTruthy()
    expect(sent(spy, "/v1/platform/shops/kirana/invite", "POST")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Actions for Kirana" }))
    await user.click(screen.getByRole("menuitem", { name: "Change owner" }))
    const email = within(screen.getByRole("dialog")).getByLabelText("Email")
    expect((email as HTMLInputElement).value).toBe("rina@kirana.id")
    await user.clear(email)
    await user.type(email, "owner@kirana.id")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(
        JSON.parse(
          String(
            sent(spy, "/v1/platform/shops/kirana/owner", "PATCH")?.[1]?.body,
          ),
        ),
      ).toEqual({ email: "owner@kirana.id", name: "Rina" }),
    )
  })

  it("suspends a shop behind a confirmation", async () => {
    const spy = platformApi((url, init) =>
      url.endsWith("/v1/platform/shops/lelap") && init?.method === "PATCH"
        ? json(shop("lelap", "Lelap", { status: "suspended" }))
        : undefined,
    )
    renderSignedIn(<PlatformPage />)
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: "Actions for Lelap" }),
    )
    await user.click(screen.getByRole("menuitem", { name: "Suspend" }))
    expect(sent(spy, "/v1/platform/shops/lelap", "PATCH")).toBeUndefined()
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Suspend",
      }),
    )
    await waitFor(() =>
      expect(
        JSON.parse(
          String(sent(spy, "/v1/platform/shops/lelap", "PATCH")?.[1]?.body),
        ),
      ).toEqual({ status: "suspended" }),
    )
  })
})
