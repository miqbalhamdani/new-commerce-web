import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import StorefrontSettingsPage from "@/app/(app)/settings/storefront/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/storefront",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

// The open tab lives in the URL's hash; each test starts on the first one.
beforeEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, "", "/settings/storefront")
})

const openTab = async (name: string) =>
  userEvent.click(await screen.findByRole("button", { name }))

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
  theme: "katalog",
  brand_color: "#9a4e3a",
  logo_r2_key: "t1/shop/abc.png",
  logo_url: "http://img/t1/shop/abc.png",
  hero_r2_key: null,
  hero_url: null,
  whatsapp_number: null,
  tagline: null,
  instagram: null,
  address: null,
  opening_hours: null,
  shopee_url: null,
  tokopedia_url: null,
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
    await openTab("Checkout")
    expect(await screen.findByText("Set")).toBeVisible()
    expect(screen.queryByLabelText("Server key")).toBeNull()
    expect(screen.getByLabelText("Notification URL")).toHaveValue(
      settings.midtrans_notification_url,
    )

    // Changes on two tabs go out in one save.
    await openTab("Contact")
    await userEvent.type(
      screen.getByLabelText("Contact email"),
      "halo@tokoabc.com",
    )
    await openTab("Checkout")
    await userEvent.click(screen.getByLabelText("SiCepat"))
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
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

    await openTab("Checkout")
    await userEvent.click(screen.getByRole("button", { name: "Replace" }))
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
    await openTab("Checkout")
    const toggle = screen.getByLabelText("Midtrans")
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

    await openTab("Checkout")
    const instructions = screen.getByLabelText("Transfer instructions")
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

  it("edits the website's look, tidying what is typed, and removes the logo (P1-704, BR-142)", async () => {
    const fetchSpy = mockApi(["settings:read", "settings:write"], (url, init) => {
      if (url.endsWith("/v1/storefront-settings") && init?.method === "PATCH")
        return json(settings)
      if (url.endsWith("/v1/storefront-settings")) return json(settings)
      return undefined
    })
    renderSignedIn(<StorefrontSettingsPage />)

    expect(await screen.findByAltText("Logo")).toHaveAttribute(
      "src",
      settings.logo_url,
    )
    await userEvent.type(screen.getByLabelText("Tagline"), "Sprei katun lokal")
    await openTab("Contact")
    await userEvent.type(
      screen.getByLabelText("WhatsApp number"),
      "62 812-3456-7890",
    )
    await userEvent.type(screen.getByLabelText("Instagram"), "@tokoabc")
    await userEvent.type(screen.getByLabelText("Address"), "Jl. Braga No. 10, Bandung")
    await userEvent.type(
      screen.getByLabelText("Shopee"),
      " https://shopee.co.id/tokoabc ",
    )
    await openTab("Website look")
    await userEvent.click(screen.getByRole("button", { name: "Remove logo" }))
    expect(screen.queryByAltText("Logo")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(
        true,
      ),
    )
    const patch = fetchSpy.mock.calls.find(([, i]) => i?.method === "PATCH")!
    expect(JSON.parse(String(patch[1]!.body))).toEqual({
      logo_r2_key: null,
      tagline: "Sprei katun lokal",
      whatsapp_number: "6281234567890",
      instagram: "tokoabc",
      address: "Jl. Braga No. 10, Bandung",
      shopee_url: "https://shopee.co.id/tokoabc",
    })
  })

  it("picks a theme, which starts on its own first colour, then one of its four (P1-805, BR-143)", async () => {
    const fetchSpy = mockApi(["settings:read", "settings:write"], (url, init) => {
      if (url.endsWith("/v1/storefront-settings") && init?.method === "PATCH")
        return json(settings)
      if (url.endsWith("/v1/storefront-settings")) return json(settings)
      return undefined
    })
    renderSignedIn(<StorefrontSettingsPage />)

    const katalog = await screen.findByRole("radio", { name: /^Katalog, suits/ })
    expect(katalog).toBeChecked()
    expect(screen.getAllByRole("radio", { name: /, suits / })).toHaveLength(8)
    expect(
      screen.getByRole("radio", { name: /Colour 2, #9a4e3a/ }),
    ).toBeChecked()
    expect(
      screen.getAllByRole("link", { name: "View demo ↗" })[0],
    ).toHaveAttribute("href", "https://sahira.belli.id")

    await userEvent.click(screen.getByRole("radio", { name: /^Furnitur Ceria, suits/ }))
    expect(
      screen.getByRole("radio", { name: /Colour 1, #0b55c4/ }),
    ).toBeChecked()
    expect(screen.queryByRole("radio", { name: /#9a4e3a/ })).toBeNull()
    await userEvent.click(screen.getByRole("radio", { name: /Colour 3, #0e7c66/ }))
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(fetchSpy.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(
        true,
      ),
    )
    const patch = fetchSpy.mock.calls.find(([, i]) => i?.method === "PATCH")!
    expect(JSON.parse(String(patch[1]!.body))).toEqual({
      theme: "furnitur-ceria",
      brand_color: "#0e7c66",
    })
  })

  it("opens the tab holding the field the API refused, and keeps it in the hash", async () => {
    mockApi(["settings:read", "settings:write"], (url, init) => {
      if (url.endsWith("/v1/storefront-settings") && init?.method === "PATCH")
        return json(
          {
            type: "https://docs.example.com/errors/validation_failed",
            title: "Validation failed",
            status: 422,
            detail: "One field is invalid",
            trace_id: "t1",
            errors: [
              { field: "whatsapp_number", detail: "Starts with 62." },
            ],
          },
          422,
        )
      if (url.endsWith("/v1/storefront-settings")) return json(settings)
      return undefined
    })
    renderSignedIn(<StorefrontSettingsPage />)

    await userEvent.type(await screen.findByLabelText("Tagline"), "Halo")
    expect(screen.getByLabelText("WhatsApp number")).not.toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Starts with 62.")).toBeVisible()
    expect(screen.getByRole("button", { name: "Contact" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(window.location.hash).toBe("#contact")
  })

  it("shows a viewer the settings with no way to save (BR-025)", async () => {
    mockApi(["settings:read"], (url) => {
      if (url.endsWith("/v1/storefront-settings")) return json(settings)
      return undefined
    })
    renderSignedIn(<StorefrontSettingsPage />)

    // The tabs sit outside the disabled form, so a viewer can still switch.
    await openTab("Checkout")
    expect(screen.getByLabelText("Ships from (postal code)")).toBeVisible()
    expect(screen.getByLabelText("Ships from (postal code)")).toHaveValue(
      "40115",
    )
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull()
  })
})

describe("the storefront settings on a plan without checkout (P1-926)", () => {
  it("has no Checkout tab, even by link, and saves only the look and contact (BR-160)", async () => {
    window.history.replaceState(null, "", "/settings/storefront#checkout")
    const fetchSpy = mockApi(
      ["settings:read", "settings:write"],
      (url, init) => {
        if (url.endsWith("/v1/storefront-settings") && init?.method === "PATCH")
          return json({ ...settings, whatsapp_number: "6281234567890" })
        if (url.endsWith("/v1/storefront-settings")) return json(settings)
        return undefined
      },
      "owner",
      false,
      "katalog",
    )
    renderSignedIn(<StorefrontSettingsPage />)

    expect(
      await screen.findByRole("button", { name: "Website look" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Checkout" })).toBeNull()
    expect(screen.getByText("Shipping")).not.toBeVisible()

    await openTab("Contact")
    await userEvent.type(
      screen.getByLabelText("WhatsApp number"),
      "6281234567890",
    )
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(([, i]) => i?.method === "PATCH"),
      ).toBe(true),
    )
    const [, init] = fetchSpy.mock.calls.find(([, i]) => i?.method === "PATCH")!
    expect(Object.keys(JSON.parse(String(init!.body)))).toEqual([
      "whatsapp_number",
    ])
  })
})
