import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Settings } from "@/lib/api/types"
import { json, mockApi, renderSignedIn } from "@/test/api"

import { SettingsForm } from "./SettingsForm"

const settings: Settings = {
  id: "t1",
  name: "Erigo",
  slug: "erigo",
  order_prefix: "ERG",
  timezone: "Asia/Jakarta",
  status: "active",
}

beforeEach(() => vi.unstubAllGlobals())

describe("SettingsForm (P1-068, P1-083)", () => {
  it("is pre-filled, notes that a new prefix is for new orders, and saves only what changed", async () => {
    const fetch = mockApi(["settings:read", "settings:write"], (url, init) =>
      url.endsWith("/v1/settings") && init?.method === "PATCH"
        ? json({ ...settings, ...JSON.parse(String(init.body)) })
        : undefined,
    )
    const onSaved = vi.fn()
    renderSignedIn(
      <SettingsForm settings={settings} canSave onSaved={onSaved} />,
    )
    expect(screen.getByLabelText("Shop name")).toHaveValue("Erigo")
    expect(screen.getByLabelText("Time zone")).toHaveTextContent(
      "WIB — Asia/Jakarta",
    )

    const prefix = screen.getByLabelText("Order number prefix")
    await userEvent.clear(prefix)
    await userEvent.type(prefix, "erx")
    expect(screen.getByRole("status")).toHaveTextContent(
      "applies to new orders only",
    )
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const patch = fetch.mock.calls.find(([, i]) => i?.method === "PATCH")!
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ order_prefix: "ERX" })
  })

  it("shows the values and no save control to anyone but the owner (BR-025)", () => {
    mockApi(["settings:read"], () => undefined, "admin")
    renderSignedIn(
      <SettingsForm settings={settings} canSave={false} onSaved={() => {}} />,
    )
    expect(screen.getByLabelText("Shop name")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
  })
})
