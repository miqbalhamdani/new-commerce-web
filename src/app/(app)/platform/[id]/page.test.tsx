import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import PlatformShopPage from "@/app/(app)/platform/[id]/page"
import { json, mockApi, renderSignedIn, sessionFor } from "@/test/api"
import { report, shop } from "@/test/platform"

const nav = vi.hoisted(() => ({
  id: "lelap",
  push: vi.fn(),
  replace: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => `/platform/${nav.id}`,
  useRouter: () => nav,
  useParams: () => ({ id: nav.id }),
}))

beforeEach(() => {
  vi.unstubAllGlobals()
  nav.push.mockReset()
})

const sent = (spy: ReturnType<typeof mockApi>, path: string, method: string) =>
  spy.mock.calls.find(
    ([u, i]) => String(u).endsWith(path) && i?.method === method,
  )
const body = (spy: ReturnType<typeof mockApi>, path: string, method: string) =>
  JSON.parse(String(sent(spy, path, method)?.[1]?.body))

function open(
  id: string,
  over: (url: string, init?: RequestInit) => Response | undefined = () =>
    undefined,
) {
  nav.id = id
  const spy = mockApi(
    [],
    (url, init) =>
      over(url, init) ??
      (url.endsWith("/v1/platform/shops") ? json(report) : undefined),
    "owner",
    true,
  )
  renderSignedIn(<PlatformShopPage />)
  return { spy, user: userEvent.setup() }
}

describe("one shop on the platform page (P1-916, BR-151)", () => {
  it("shows the owner, the plan, the website and the catalog", async () => {
    open("lelap")
    expect(await screen.findByRole("heading", { name: "Lelap" })).toBeTruthy()
    expect(screen.getByText("lelap@example.com")).toBeTruthy()
    expect(screen.getByText("Jualan, no end date")).toBeTruthy()
    expect(screen.getByText("Retail shop")).toBeTruthy()
    expect(screen.getByText("live of 4")).toBeTruthy()
    // The fixture has no WhatsApp number.
    expect(screen.getByText("Not set")).toBeTruthy()
    // Only an invited owner has the hand-over actions.
    expect(screen.queryByRole("button", { name: "Send invite" })).toBeNull()
    expect(
      screen.getByRole("link", { name: "Visit website" }).getAttribute("href"),
    ).toBe("https://lelap.belli.id")
  })

  it("sends the invite and changes the owner while invited", async () => {
    const { spy, user } = open("kirana", (url, init) => {
      if (url.endsWith("/kirana/invite"))
        return new Response(null, { status: 204 })
      if (url.endsWith("/kirana/owner") && init?.method === "PATCH")
        return json(shop("kirana", "Kirana"))
      return undefined
    })
    await user.click(await screen.findByRole("button", { name: "Send invite" }))
    expect(
      await screen.findByText("Invite sent to rina@kirana.id."),
    ).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Change owner" }))
    const email = within(screen.getByRole("dialog")).getByLabelText("Email")
    await user.clear(email)
    await user.type(email, "owner@kirana.id")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(body(spy, "/v1/platform/shops/kirana/owner", "PATCH")).toEqual({
        email: "owner@kirana.id",
        name: "Rina",
      }),
    )
  })

  it("changes the plan and the business type (BR-160, BR-170)", async () => {
    const { spy, user } = open("lelap", (url, init) =>
      init?.method === "PATCH" ? json(shop("lelap", "Lelap")) : undefined,
    )
    await user.click(await screen.findByRole("button", { name: "Change plan" }))
    let dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByLabelText("Plan"))
    await user.click(await screen.findByRole("option", { name: "Katalog" }))
    await user.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(body(spy, "/v1/platform/shops/lelap/plan", "PATCH")).toEqual({
        plan: "katalog",
        plan_until: null,
      }),
    )

    await user.click(
      screen.getByRole("button", { name: "Change business type" }),
    )
    dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByLabelText("Business type"))
    await user.click(
      await screen.findByRole("option", { name: "Umrah travel" }),
    )
    await user.click(within(dialog).getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(
        body(spy, "/v1/platform/shops/lelap/business-type", "PATCH"),
      ).toEqual({
        business_type: "umrah",
      }),
    )
  })

  it("opens the shop as its owner (P1-917, BR-152)", async () => {
    const { spy, user } = open("lelap", (url, init) =>
      url.endsWith("/lelap/impersonate") && init?.method === "POST"
        ? json({
            ...sessionFor(["products:read"], "owner"),
            tenant: { id: "lelap", name: "Lelap", timezone: "Asia/Jakarta" },
          })
        : undefined,
    )
    await user.click(
      await screen.findByRole("button", { name: "Open as owner" }),
    )
    await waitFor(() =>
      expect(
        sent(spy, "/v1/platform/shops/lelap/impersonate", "POST"),
      ).toBeTruthy(),
    )
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/"))
  })

  it("suspends the shop only after confirming", async () => {
    const { spy, user } = open("lelap", (url, init) =>
      url.endsWith("/v1/platform/shops/lelap") && init?.method === "PATCH"
        ? json(shop("lelap", "Lelap", { status: "suspended" }))
        : undefined,
    )
    await user.click(await screen.findByRole("button", { name: "Suspend" }))
    expect(sent(spy, "/v1/platform/shops/lelap", "PATCH")).toBeUndefined()
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Suspend",
      }),
    )
    await waitFor(() =>
      expect(body(spy, "/v1/platform/shops/lelap", "PATCH")).toEqual({
        status: "suspended",
      }),
    )
  })

  it("says so for a shop that does not exist", async () => {
    open("nope")
    expect(await screen.findByText("No such shop.")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Back to Platform" })
        .getAttribute("href"),
    ).toBe("/platform")
  })
})
