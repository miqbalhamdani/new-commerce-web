import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { json, renderSignedIn, sessionFor } from "@/test/api"

import ForgotPasswordPage from "../forgot-password/page"
import ResetPasswordPage from "./page"

const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }))

function mockFetch(path: string, answer: (body: unknown) => Response) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/v1/auth/refresh"))
      return json({ type: "x", title: "x", status: 401, trace_id: "t" }, 401)
    if (url.endsWith(path)) return answer(JSON.parse(String(init!.body)))
    return json({}, 404)
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

async function typePasswords(first: string, second = first) {
  await userEvent.type(await screen.findByLabelText("Password"), first)
  await userEvent.type(screen.getByLabelText("The same password again"), second)
  await userEvent.click(
    screen.getByRole("button", { name: "Set password and sign in" }),
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
  replace.mockReset()
  window.location.hash = "#token=prt_abc.def"
})

describe("forgot and reset password (P1-089)", () => {
  it("asks for a link and says the same for any email", async () => {
    const fetch = mockFetch("/v1/auth/password-reset", () => json(null, 202))
    renderSignedIn(<ForgotPasswordPage />)
    await userEvent.type(
      await screen.findByLabelText(/Email/),
      "budi@erigo.co.id",
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Send reset link" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Check your inbox" }),
    ).toBeInTheDocument()
    const call = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("/password-reset"),
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      email: "budi@erigo.co.id",
    })
  })

  it("sets a password from the link's token and signs in", async () => {
    const fetch = mockFetch("/v1/auth/password-reset/confirm", () =>
      json(sessionFor(["settings:write"], "owner")),
    )
    renderSignedIn(<ResetPasswordPage />)
    await typePasswords("a-good-password")
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"))
    const call = fetch.mock.calls.find(([u]) => String(u).endsWith("/confirm"))!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      token: "prt_abc.def",
      password: "a-good-password",
    })
  })

  it("says an expired or used link needs a new one", async () => {
    mockFetch("/v1/auth/password-reset/confirm", () =>
      json(
        {
          type: "x/validation_failed",
          title: "Validation failed",
          status: 422,
          trace_id: "t",
          errors: [
            {
              field: "token",
              detail:
                "This reset link has expired or was already used. Ask for a new one.",
            },
          ],
        },
        422,
      ),
    )
    renderSignedIn(<ResetPasswordPage />)
    await typePasswords("a-good-password")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ask for a new one",
    )
    expect(replace).not.toHaveBeenCalled()
  })

  it("stops two different passwords before asking the API", async () => {
    const fetch = mockFetch("/v1/auth/password-reset/confirm", () =>
      json(sessionFor([], "owner")),
    )
    renderSignedIn(<ResetPasswordPage />)
    await typePasswords("a-good-password", "another-password")
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The two passwords are not the same.",
    )
    expect(fetch.mock.calls.some(([u]) => String(u).endsWith("/confirm"))).toBe(
      false,
    )
  })
})
