import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { json, renderSignedIn } from "@/test/api"

import RegisterPage from "./page"

function mockFetch(register: (body: unknown) => Response) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/v1/auth/refresh"))
      return json({ type: "x", title: "x", status: 401, trace_id: "t" }, 401)
    if (url.endsWith("/v1/auth/register"))
      return register(JSON.parse(String(init!.body)))
    return json({}, 404)
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

async function fillAndSubmit() {
  await userEvent.type(await screen.findByLabelText("Shop name"), "Erigo")
  await userEvent.type(screen.getByLabelText("Your name"), "Budi")
  await userEvent.type(screen.getByLabelText("Email"), "budi@erigo.co.id")
  await userEvent.click(screen.getByRole("button", { name: "Create shop" }))
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe("the register screen (P1-085)", () => {
  it("sends exactly the shop name, name and email, then says check your inbox", async () => {
    const fetch = mockFetch(() => new Response(null, { status: 202 }))
    renderSignedIn(<RegisterPage />)
    await fillAndSubmit()
    expect(await screen.findByRole("status")).toHaveTextContent(
      "budi@erigo.co.id",
    )
    expect(
      screen.getByRole("heading", { name: "Check your inbox" }),
    ).toBeInTheDocument()
    const call = fetch.mock.calls.find(([u]) => String(u).endsWith("register"))!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      shop_name: "Erigo",
      name: "Budi",
      email: "budi@erigo.co.id",
    })
  })

  it("shows the field's problem when the API refuses the input", async () => {
    mockFetch(() =>
      json(
        {
          type: "x/validation_failed",
          title: "Validation failed",
          status: 422,
          trace_id: "t",
          errors: [{ field: "email", detail: "email is not a valid address" }],
        },
        422,
      ),
    )
    renderSignedIn(<RegisterPage />)
    await fillAndSubmit()
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "email is not a valid address",
    )
    expect(screen.queryByText("Check your inbox")).not.toBeInTheDocument()
  })

  it("says to wait when there were too many tries", async () => {
    mockFetch(() =>
      json(
        {
          type: "x/rate_limited",
          title: "Too many requests",
          status: 429,
          detail: "Too many requests. Try again later.",
          trace_id: "t",
        },
        429,
      ),
    )
    renderSignedIn(<RegisterPage />)
    await fillAndSubmit()
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Try again later",
    )
  })

  it("links back to sign in", async () => {
    mockFetch(() => new Response(null, { status: 202 }))
    renderSignedIn(<RegisterPage />)
    expect(
      await screen.findByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login")
  })
})
