import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { json, renderSignedIn, sessionFor } from "@/test/api"

import AcceptInvitePage from "./page"

const replace = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }))

function mockFetch(
  accept: (body: { token: string; password: string }) => Response,
) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/v1/auth/refresh"))
      return json({ type: "x", title: "x", status: 401, trace_id: "t" }, 401)
    if (url.endsWith("/v1/auth/accept-invite"))
      return accept(JSON.parse(String(init!.body)))
    return json({}, 404)
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

beforeEach(() => {
  vi.unstubAllGlobals()
  replace.mockReset()
  window.location.hash = "#token=inv_abc.def"
})

describe("accept invitation (P1-079)", () => {
  it("sets a password from the link's token and signs in", async () => {
    const fetch = mockFetch(() => json(sessionFor(["products:read"], "ops")))
    renderSignedIn(<AcceptInvitePage />)
    await userEvent.type(
      await screen.findByLabelText("Password"),
      "a-good-password",
    )
    await userEvent.type(
      screen.getByLabelText("The same password again"),
      "a-good-password",
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Set password and sign in" }),
    )
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"))
    const call = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("accept-invite"),
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      token: "inv_abc.def",
      password: "a-good-password",
    })
  })

  it("says an expired or used link needs a new invitation", async () => {
    mockFetch(() =>
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
                "This invitation link has expired or was already used. Ask for a new invitation.",
            },
          ],
        },
        422,
      ),
    )
    renderSignedIn(<AcceptInvitePage />)
    await userEvent.type(
      await screen.findByLabelText("Password"),
      "a-good-password",
    )
    await userEvent.type(
      screen.getByLabelText("The same password again"),
      "a-good-password",
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Set password and sign in" }),
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ask for a new invitation",
    )
    expect(replace).not.toHaveBeenCalled()
  })
})
