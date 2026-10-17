import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Settings } from "@/lib/api/types"
import { json, mockApi, renderSignedIn } from "@/test/api"

import OnboardingPage from "./page"

vi.mock("next/navigation", () => ({
  usePathname: () => "/onboarding",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const settings: Settings = {
  id: "t1",
  name: "Erigo",
  slug: "erigo-1a2b3c",
  order_prefix: "ERI",
  timezone: "Asia/Jakarta",
  status: "active",
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe("the onboarding wizard (P1-068)", () => {
  it("goes back a step from the brand and from the categories", async () => {
    const fetch = mockApi(
      ["settings:read", "settings:write"],
      (url, init) => {
        if (url.endsWith("/v1/settings") && !init?.method) return json(settings)
        return undefined
      },
      "owner",
    )
    renderSignedIn(<OnboardingPage />)

    await userEvent.click(
      await screen.findByRole("button", { name: "Continue" }),
    )
    expect(
      await screen.findByLabelText("The brand you sell"),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(await screen.findByLabelText("Shop name")).toHaveValue("Erigo")

    await userEvent.click(screen.getByRole("button", { name: "Continue" }))
    await userEvent.click(await screen.findByRole("button", { name: /^Skip/ }))
    expect(await screen.findByLabelText("Main category")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(
      await screen.findByLabelText("The brand you sell"),
    ).toBeInTheDocument()

    // Unchanged settings save nothing; skipping the brand posts nothing.
    expect(
      fetch.mock.calls.filter(
        ([url, init]) =>
          !String(url).endsWith("/v1/auth/refresh") &&
          init?.method &&
          init.method !== "GET",
      ),
    ).toHaveLength(0)
  })
})
