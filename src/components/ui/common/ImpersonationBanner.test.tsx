import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ImpersonationBanner } from "@/components/ui/common/ImpersonationBanner"
import { json, renderSignedIn, sessionFor } from "@/test/api"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}))

beforeEach(() => {
  vi.unstubAllGlobals()
  push.mockReset()
})

describe("the impersonation banner (P1-917, BR-152)", () => {
  it("is not there in an ordinary session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(sessionFor([], "owner", true))),
    )
    renderSignedIn(<ImpersonationBanner />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByText(/as its owner/)).toBeNull()
  })

  it("names the shop, and Back to Platform restores the admin's session", async () => {
    const shop = sessionFor(["products:read"], "owner")
    shop.user.impersonating = true
    shop.tenant.name = "Toko Klien"
    const sessions = [shop, sessionFor([], "owner", true)]
    const spy = vi.fn(async () => json(sessions.shift()))
    vi.stubGlobal("fetch", spy)

    renderSignedIn(<ImpersonationBanner />)
    expect(await screen.findByText("Toko Klien")).toBeTruthy()
    await userEvent.click(
      screen.getByRole("button", { name: "Back to Platform" }),
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/platform"))
    expect(spy).toHaveBeenCalledTimes(2)
    expect(String((spy.mock.calls[1] as unknown[])[0])).toMatch(
      /\/v1\/auth\/refresh$/,
    )
    expect(screen.queryByText("Toko Klien")).toBeNull()
  })
})
