import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import PlatformPage from "@/app/(app)/platform/page"
import { json, mockApi, renderSignedIn } from "@/test/api"
import { report, shop } from "@/test/platform"

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/platform",
  useRouter: () => nav,
  useSearchParams: () => new URLSearchParams(),
}))

beforeEach(() => {
  vi.unstubAllGlobals()
  nav.push.mockReset()
  nav.replace.mockReset()
})

const rows = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0].textContent)

function platformApi(
  over: (url: string, init?: RequestInit) => Response | undefined = () =>
    undefined,
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

  it("shows Insights and lists the shops without demo ones", async () => {
    platformApi()
    renderSignedIn(<PlatformPage />)
    await screen.findByText("Insights")
    expect(screen.getByText("Got an order")).toBeTruthy()
    expect(screen.queryByText("Need attention")).toBeNull()
    expect(screen.queryByRole("button", { name: /^All \d/ })).toBeNull()

    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getByRole("link").textContent)
    expect(names).toEqual(["Lelap", "Kirana", "Seruni"])
    expect(
      screen.getByRole("link", { name: "Lelap" }).getAttribute("href"),
    ).toBe("/platform/lelap")
    expect(screen.getAllByRole("columnheader")).toHaveLength(5)
  })

  it("filters by status, plan, demo shops and search, and keeps them in the URL", async () => {
    platformApi((url) =>
      url.endsWith("/v1/platform/shops")
        ? json({
            ...report,
            shops: [...report.shops, shop("murni", "Murni", { plan: "mulai" })],
          })
        : undefined,
    )
    renderSignedIn(<PlatformPage />)
    await screen.findByText("Insights")
    const user = userEvent.setup()
    const pick = async (filter: string, option: string) => {
      await user.click(screen.getByLabelText(filter))
      await user.click(await screen.findByRole("option", { name: option }))
    }

    await pick("Status", "Not verified")
    expect(rows()).toHaveLength(1)
    expect(screen.getByText("rina@kirana.id")).toBeTruthy()
    expect(nav.replace).toHaveBeenLastCalledWith("/platform?status=unverified")

    await pick("Status", "All statuses")
    await pick("Plan", "Mulai")
    expect(rows()).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Murni" })).toBeTruthy()

    await pick("Plan", "All plans")
    await pick("Shops", "Demo shops")
    expect(rows()).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Sahira" })).toBeTruthy()
    expect(nav.replace).toHaveBeenLastCalledWith("/platform?demo=1")

    await pick("Shops", "Real shops")
    await user.type(screen.getByLabelText("Search shops"), "rina@")
    expect(rows()).toHaveLength(1)
    expect(nav.replace).toHaveBeenLastCalledWith("/platform?q=rina%40")
  })

  it("opens a shop from its row", async () => {
    platformApi()
    renderSignedIn(<PlatformPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByText("rina@kirana.id"))
    expect(nav.push).toHaveBeenCalledWith("/platform/kirana")
  })

  it("opens a held shop, and shows a taken email on its field (P1-916)", async () => {
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
    const sent = spy.mock.calls.filter(
      ([u, i]) =>
        String(u).endsWith("/v1/platform/shops") && i?.method === "POST",
    )
    expect(JSON.parse(String(sent.at(-1)?.[1]?.body))).toEqual({
      shop_name: "Toko Baru",
      owner_name: "Rina",
      owner_email: "rina@lelap.id",
      send_invite: false,
      plan: "mulai",
      business_type: "retail",
    })
  })
})
