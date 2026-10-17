import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { json, renderSignedIn, sessionFor } from "@/test/api"
import { fakeGoogle } from "@/test/google"

import RegisterPage from "./page"

const replace = vi.fn()
const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }))

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

const bodyOf = (spy: ReturnType<typeof mockFetch>, path: string) =>
  JSON.parse(
    String(spy.mock.calls.find(([u]) => String(u).endsWith(path))![1]!.body),
  )

beforeEach(() => {
  vi.unstubAllGlobals()
  replace.mockReset()
  push.mockReset()
})
afterEach(() => {
  delete window.google
})

describe("the sign-up screen (P1-085, P1-087)", () => {
  it("sends the shop name, name and email, then opens the code screen", async () => {
    const fetch = mockFetch(null, {
      "/v1/auth/register": () => new Response(null, { status: 202 }),
    })
    renderSignedIn(<RegisterPage />)
    await userEvent.type(
      screen.getByRole("textbox", { name: "Shop name" }),
      "Erigo",
    )
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your name" }),
      "Budi",
    )
    await userEvent.type(
      screen.getByRole("textbox", { name: "Email" }),
      "budi@erigo.co.id",
    )
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/verify#email=budi%40erigo.co.id"),
    )
    expect(bodyOf(fetch, "/v1/auth/register")).toEqual({
      shop_name: "Erigo",
      name: "Budi",
      email: "budi@erigo.co.id",
    })
  })

  it("shows the API's reason when it refuses the input", async () => {
    mockFetch(null, {
      "/v1/auth/register": () =>
        json(
          {
            type: "x/validation_failed",
            title: "Validation failed",
            status: 422,
            trace_id: "t",
            errors: [
              { field: "email", detail: "email is not a valid address" },
            ],
          },
          422,
        ),
    })
    renderSignedIn(<RegisterPage />)
    await userEvent.type(
      screen.getByRole("textbox", { name: "Shop name" }),
      "Erigo",
    )
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your name" }),
      "Budi",
    )
    await userEvent.type(
      screen.getByRole("textbox", { name: "Email" }),
      "budi@erigo.co.id",
    )
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "email is not a valid address",
    )
    expect(push).not.toHaveBeenCalled()
  })

  it("after Google, asks only the shop name and opens onboarding", async () => {
    const google = fakeGoogle()
    const fetch = mockFetch("cid.apps.googleusercontent.com", {
      "/v1/auth/register/google": () =>
        json(sessionFor(["settings:write"], "owner"), 201),
    })
    renderSignedIn(<RegisterPage />)
    await waitFor(() => expect(google.renderButton).toHaveBeenCalled())
    google.signIn("google-id-token")
    expect(
      await screen.findByRole("heading", { name: "One more step" }),
    ).toBeInTheDocument()
    await userEvent.type(
      screen.getByRole("textbox", { name: "Shop name" }),
      "Erigo",
    )
    await userEvent.click(screen.getByRole("button", { name: "Create shop" }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"))
    expect(bodyOf(fetch, "/v1/auth/register/google")).toEqual({
      id_token: "google-id-token",
      shop_name: "Erigo",
    })
  })

  it("links to sign in", () => {
    mockFetch(null, {})
    renderSignedIn(<RegisterPage />)
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/login",
    )
  })
})
