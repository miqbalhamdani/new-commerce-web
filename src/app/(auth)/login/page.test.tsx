import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { json, renderSignedIn, sessionFor } from "@/test/api"
import { fakeGoogle } from "@/test/google"

import LoginPage from "./page"

const replace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}))

function mockFetch(
  clientId: string | null,
  routes: Record<string, (body: unknown) => Response>,
) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/v1/auth/refresh"))
      return json({ type: "x", title: "x", status: 401, trace_id: "t" }, 401)
    if (url.endsWith("/v1/auth/providers"))
      return json({ google_client_id: clientId })
    const path = Object.keys(routes).find((p) => url.endsWith(p))
    return path ? routes[path](JSON.parse(String(init!.body))) : json({}, 404)
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

beforeEach(() => {
  vi.unstubAllGlobals()
  replace.mockReset()
  window.history.replaceState(null, "", "/login")
})
afterEach(() => {
  delete window.google
})

describe("the sign-in screen (P1-087)", () => {
  it("signs straight into the demo shop from a belli.id demo link", async () => {
    window.history.replaceState(
      null,
      "",
      "/login?u=viewer@demo.belli.id&p=demo-password",
    )
    const fetch = mockFetch(null, {
      "/v1/auth/login": () => json(sessionFor(["products:read"])),
    })
    renderSignedIn(<LoginPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"))
    const call = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("/v1/auth/login"),
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      email: "viewer@demo.belli.id",
      password: "demo-password",
    })
    expect(window.location.search).toBe("")
  })

  it("ignores ?u=&p= for an account outside the demo domain", async () => {
    window.history.replaceState(null, "", "/login?u=ops@erigo.co.id&p=pw")
    const fetch = mockFetch(null, {
      "/v1/auth/login": () => json(sessionFor(["products:read"])),
    })
    renderSignedIn(<LoginPage />)
    await waitFor(() => expect(window.location.search).toBe(""))
    expect(
      fetch.mock.calls.some(([u]) => String(u).endsWith("/v1/auth/login")),
    ).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })

  it("signs in with email and password", async () => {
    const fetch = mockFetch(null, {
      "/v1/auth/login": () => json(sessionFor(["products:read"])),
    })
    renderSignedIn(<LoginPage />)
    await userEvent.type(
      screen.getByRole("textbox", { name: "Email" }),
      "ops@erigo.co.id",
    )
    await userEvent.type(screen.getByLabelText(/^Password/), "a-good-password")
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"))
    const call = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("/v1/auth/login"),
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      email: "ops@erigo.co.id",
      password: "a-good-password",
    })
    expect(screen.getByRole("link", { name: "Sign Up" })).toHaveAttribute(
      "href",
      "/register",
    )
  })

  it("shows no Google button while the API names no client ID", async () => {
    const fetch = mockFetch(null, {})
    renderSignedIn(<LoginPage />)
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([u]) =>
          String(u).endsWith("/v1/auth/providers"),
        ),
      ).toBe(true),
    )
    expect(screen.queryByTestId("google-button")).not.toBeInTheDocument()
    expect(screen.queryByText("Or")).not.toBeInTheDocument()
  })

  it("signs in with Google's credential", async () => {
    const google = fakeGoogle()
    const fetch = mockFetch("cid.apps.googleusercontent.com", {
      "/v1/auth/google": () => json(sessionFor(["products:read"])),
    })
    renderSignedIn(<LoginPage />)
    await waitFor(() => expect(google.renderButton).toHaveBeenCalled())
    expect(screen.getByText("Or")).toBeInTheDocument()
    google.signIn("google-id-token")
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"))
    const call = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("/v1/auth/google"),
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      id_token: "google-id-token",
    })
  })

  it("says so when no account uses the Google email", async () => {
    const google = fakeGoogle()
    mockFetch("cid.apps.googleusercontent.com", {
      "/v1/auth/google": () =>
        json(
          {
            type: "x/unauthenticated",
            title: "Unauthenticated",
            status: 401,
            detail:
              "No account uses this Google email. Sign up to open a shop.",
            trace_id: "t",
          },
          401,
        ),
    })
    renderSignedIn(<LoginPage />)
    await waitFor(() => expect(google.renderButton).toHaveBeenCalled())
    google.signIn("google-id-token")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No account uses this Google email",
    )
    expect(replace).not.toHaveBeenCalled()
  })
})
