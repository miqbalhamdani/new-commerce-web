import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import StorefrontSettingsPage from "@/app/(app)/settings/storefront/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/storefront",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

const settings = {
  contact_email: null,
  google_client_id: null,
  origin_postal_code: "40115",
  shipping_couriers: ["jne"],
  bank_transfer_enabled: true,
  bank_transfer_instructions: "Transfer to BCA 123",
  midtrans_enabled: false,
  midtrans_environment: null,
  midtrans_client_key: null,
  midtrans_server_key_set: true,
  midtrans_notification_url: "http://localhost:8080/v1/webhooks/midtrans/5b0e",
  updated_at: "2026-10-06T16:15:00+07:00",
}

describe("the storefront settings screen (P1-217)", () => {
  it("sends only what changed, and a server key only when one is typed (BR-129)", async () => {
    const fetchSpy = mockApi(
      ["settings:read", "settings:write"],
      (url, init) => {
        if (url.endsWith("/v1/storefront-settings") && init?.method === "PATCH")
          return json({ ...settings, contact_email: "halo@tokoabc.com" })
        // Enabled, so the Midtrans section is open and its fields visible.
        if (url.endsWith("/v1/storefront-settings"))
          return json({ ...settings, midtrans_enabled: true })
        return undefined
      },
    )
    renderSignedIn(<StorefrontSettingsPage />)

    // The key is never on screen: only that it is set, and the way to replace it.
    expect(await screen.findByText("Set")).toBeInTheDocument()
    expect(screen.queryByLabelText("Server key")).toBeNull()
    expect(screen.getByLabelText("Notification URL")).toHaveValue(
      settings.midtrans_notification_url,
    )

    await userEvent.type(
      screen.getByLabelText("Contact email"),
      "halo@tokoabc.com",
    )
    await userEvent.click(screen.getByLabelText("SiCepat"))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(
        true,
      ),
    )
    const patch = fetchSpy.mock.calls.find(([, i]) => i?.method === "PATCH")!
    expect(JSON.parse(String(patch[1]!.body))).toEqual({
      contact_email: "halo@tokoabc.com",
      shipping_couriers: ["jne", "sicepat"],
    })
  })

  it("replaces the server key on request, and clears a field to null", async () => {
    const fetchSpy = mockApi(["settings:read", "settings:write"], (url) => {
      if (url.endsWith("/v1/storefront-settings"))
        return json({ ...settings, midtrans_enabled: true })
      return undefined
    })
    renderSignedIn(<StorefrontSettingsPage />)

    await userEvent.click(
      await screen.findByRole("button", { name: "Replace" }),
    )
    await userEvent.type(screen.getByLabelText("Server key"), "Mid-server-new")
    await userEvent.clear(screen.getByLabelText("Transfer instructions"))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(
        true,
      ),
    )
    const patch = fetchSpy.mock.calls.find(([, i]) => i?.method === "PATCH")!
    expect(JSON.parse(String(patch[1]!.body))).toEqual({
      bank_transfer_instructions: null,
      midtrans_server_key: "Mid-server-new",
    })
  })

  it("shows the API's reason next to the field", async () => {
    mockApi(["settings:read", "settings:write"], (url, init) => {
      if (url.endsWith("/v1/storefront-settings") && init?.method === "PATCH")
        return json(
          {
            type: "https://docs.example.com/errors/validation_failed",
            title: "Validation failed",
            status: 422,
            detail: "Midtrans needs its keys",
            trace_id: "t1",
            errors: [
              {
                field: "midtrans_enabled",
                detail:
                  "Midtrans needs its environment, client key and server key before it can be turned on.",
              },
            ],
          },
          422,
        )
      if (url.endsWith("/v1/storefront-settings")) return json(settings)
      return undefined
    })
    renderSignedIn(<StorefrontSettingsPage />)

    // A method's fields stay hidden until it is switched on.
    const toggle = await screen.findByLabelText("Midtrans")
    expect(screen.queryByLabelText("Client key")).toBeNull()
    await userEvent.click(toggle)
    expect(screen.getByLabelText("Client key")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(
      await screen.findByText(
        /Midtrans needs its environment, client key and server key/,
      ),
    ).toBeInTheDocument()
  })

  it("prefills transfer instructions and refuses to send their xxx parts", async () => {
    const fetchSpy = mockApi(["settings:read", "settings:write"], (url, init) => {
      if (url.endsWith("/v1/storefront-settings") && init?.method === "PATCH")
        return json(settings)
      if (url.endsWith("/v1/storefront-settings"))
        return json({ ...settings, bank_transfer_instructions: null })
      return undefined
    })
    const patches = () =>
      fetchSpy.mock.calls.filter(([, i]) => i?.method === "PATCH")
    renderSignedIn(<StorefrontSettingsPage />)

    const instructions = await screen.findByLabelText("Transfer instructions")
    expect((instructions as HTMLTextAreaElement).value).toContain(
      "Account number: xxx",
    )

    // Edited but still holding xxx: stopped before it reaches the API.
    await userEvent.type(instructions, " Thanks!")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(
      await screen.findByText("Replace the xxx parts with your bank details."),
    ).toBeInTheDocument()
    expect(patches()).toHaveLength(0)

    // Real details go through, and only they are sent.
    await userEvent.clear(instructions)
    await userEvent.type(instructions, "Transfer to BCA 123")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(JSON.parse(String(patches()[0]![1]!.body))).toEqual({
      bank_transfer_instructions: "Transfer to BCA 123",
    })
  })

  it("shows a viewer the settings with no way to save (BR-025)", async () => {
    mockApi(["settings:read"], (url) => {
      if (url.endsWith("/v1/storefront-settings")) return json(settings)
      return undefined
    })
    renderSignedIn(<StorefrontSettingsPage />)

    expect(
      await screen.findByLabelText("Ships from (postal code)"),
    ).toHaveValue("40115")
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull()
  })
})
