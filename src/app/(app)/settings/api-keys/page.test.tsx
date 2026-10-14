import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ApiKeysPage from "@/app/(app)/settings/api-keys/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/api-keys",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

const key = {
  id: "k1",
  name: "Main website",
  key_last4: "42ab",
  allowed_origin: "https://tokoabc.com",
  created_by: { id: "u1", name: "Budi" },
  last_used_at: null,
  revoked_at: null,
  created_at: "2026-10-06T16:15:00+07:00",
}

describe("the API keys screen (P1-201)", () => {
  it("shows a new key once, and only the explicit button closes it (BR-028)", async () => {
    const fetchSpy = mockApi(["api_keys:read", "api_keys:write"], (url, init) => {
      if (url.endsWith("/v1/api-keys") && init?.method === "POST")
        return json(
          { ...key, id: "k2", name: "Shop", key: "sf_live_secret123" },
          201,
        )
      if (url.endsWith("/v1/api-keys")) return json({ data: [key] })
      return undefined
    })
    renderSignedIn(<ApiKeysPage />)

    expect(await screen.findByText("Main website")).toBeInTheDocument()
    expect(screen.getByText("https://tokoabc.com")).toBeInTheDocument()
    expect(screen.getByText("sf_live_************42ab")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Storefront API documentation" }),
    ).toHaveAttribute("href", "/v1/storefront/openapi.json")

    await userEvent.click(screen.getByRole("button", { name: "Create key" }))
    await userEvent.type(screen.getByLabelText("Name"), "Shop")
    await userEvent.type(
      screen.getByLabelText("Website address"),
      "https://tokoabc.com",
    )
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create key",
      }),
    )

    const shown = await screen.findByLabelText("API key")
    expect(shown).toHaveValue("sf_live_secret123")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This is the only time the key is shown",
    )
    const post = fetchSpy.mock.calls.find(
      ([u, i]) => String(u).endsWith("/v1/api-keys") && i?.method === "POST",
    )!
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      name: "Shop",
      allowed_origin: "https://tokoabc.com",
    })

    await userEvent.keyboard("{Escape}")
    expect(screen.getByLabelText("API key")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "I've copied it" }))
    expect(screen.queryByLabelText("API key")).toBeNull()
  })

  it("shows the origin rule next to the field on 422", async () => {
    mockApi(["api_keys:read", "api_keys:write"], (url, init) => {
      if (url.endsWith("/v1/api-keys") && init?.method === "POST")
        return json(
          {
            type: "https://docs.example.com/errors/validation_failed",
            title: "Validation failed",
            status: 422,
            detail: "allowed_origin is one exact scheme://host[:port]",
            trace_id: "t1",
            errors: [
              { field: "allowed_origin", detail: "No path or trailing slash." },
            ],
          },
          422,
        )
      if (url.endsWith("/v1/api-keys")) return json({ data: [] })
      return undefined
    })
    renderSignedIn(<ApiKeysPage />)

    await userEvent.click(await screen.findByRole("button", { name: "Create key" }))
    await userEvent.type(screen.getByLabelText("Name"), "Shop")
    await userEvent.type(
      screen.getByLabelText("Website address"),
      "https://tokoabc.com/",
    )
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create key",
      }),
    )
    expect(
      await screen.findByText("No path or trailing slash."),
    ).toBeInTheDocument()
  })

  it("revokes after a confirm", async () => {
    const fetchSpy = mockApi(["api_keys:read", "api_keys:write"], (url, init) => {
      if (url.endsWith("/v1/api-keys/k1") && init?.method === "DELETE")
        return new Response(null, { status: 204 })
      if (url.endsWith("/v1/api-keys")) return json({ data: [key] })
      return undefined
    })
    renderSignedIn(<ApiKeysPage />)

    await userEvent.click(
      await screen.findByRole("button", { name: "Actions for Main website" }),
    )
    await userEvent.click(screen.getByRole("menuitem", { name: "Revoke" }))
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Revoke" }),
    )
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(
          ([u, i]) =>
            String(u).endsWith("/v1/api-keys/k1") && i?.method === "DELETE",
        ),
      ).toBe(true),
    )
  })

  it("offers no create or row actions without api_keys:write (BR-025)", async () => {
    mockApi(["api_keys:read"], (url) => {
      if (url.endsWith("/v1/api-keys")) return json({ data: [key] })
      return undefined
    })
    renderSignedIn(<ApiKeysPage />)

    expect(await screen.findByText("Main website")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Create key" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Actions for Main website" }),
    ).toBeNull()
  })
})
