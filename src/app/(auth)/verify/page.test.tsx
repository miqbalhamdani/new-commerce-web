import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { json, renderSignedIn } from "@/test/api"

import VerifyPage from "./page"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}))

function mockFetch(routes: Record<string, (body: unknown) => Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/v1/auth/refresh"))
      return json({ type: "x", title: "x", status: 401, trace_id: "t" }, 401)
    const path = Object.keys(routes).find((p) => url.endsWith(p))
    return path ? routes[path](JSON.parse(String(init!.body))) : json({}, 404)
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

const digit = (n: number) =>
  screen.findByRole("textbox", { name: `Digit ${n} of 6` })

beforeEach(() => {
  vi.unstubAllGlobals()
  push.mockReset()
  window.location.hash = "#email=budi%40erigo.co.id"
})

describe("the verify-email screen (P1-087)", () => {
  it("sends the six digits and carries the token to the password step", async () => {
    const fetch = mockFetch({
      "/v1/auth/verify-code": () => json({ token: "inv_abc.def" }),
    })
    renderSignedIn(<VerifyPage />)
    expect(await screen.findByText("budi@erigo.co.id")).toBeInTheDocument()
    await userEvent.click(await digit(1))
    await userEvent.keyboard("482913")
    expect(await digit(6)).toHaveValue("3")
    await userEvent.click(
      screen.getByRole("button", { name: "Verify my account" }),
    )
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/accept-invite#token=inv_abc.def&signup=1",
      ),
    )
    const call = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("/v1/auth/verify-code"),
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      email: "budi@erigo.co.id",
      code: "482913",
    })
  })

  it("fills every box from a pasted code", async () => {
    mockFetch({})
    renderSignedIn(<VerifyPage />)
    await userEvent.click(await digit(1))
    await userEvent.paste("48 29 13")
    for (const [n, v] of [
      [1, "4"],
      [2, "8"],
      [6, "3"],
    ] as const)
      expect(await digit(n)).toHaveValue(v)
  })

  it("says why a code was refused", async () => {
    mockFetch({
      "/v1/auth/verify-code": () =>
        json(
          {
            type: "x/validation_failed",
            title: "Validation failed",
            status: 422,
            trace_id: "t",
            errors: [
              { field: "code", detail: "This code is wrong or has expired." },
            ],
          },
          422,
        ),
    })
    renderSignedIn(<VerifyPage />)
    await userEvent.click(await digit(1))
    await userEvent.keyboard("000000")
    await userEvent.click(
      screen.getByRole("button", { name: "Verify my account" }),
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This code is wrong or has expired.",
    )
    expect(push).not.toHaveBeenCalled()
  })

  it("resends the code, then waits before allowing another", async () => {
    const fetch = mockFetch({
      "/v1/auth/resend-code": () => new Response(null, { status: 202 }),
    })
    renderSignedIn(<VerifyPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Resend" }))
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sent again to budi@erigo.co.id",
    )
    expect(screen.getByRole("button", { name: /^Resend in/ })).toBeDisabled()
    const call = fetch.mock.calls.find(([u]) =>
      String(u).endsWith("/v1/auth/resend-code"),
    )!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      email: "budi@erigo.co.id",
    })
  })

  it("asks for the email when the link did not carry it", async () => {
    window.location.hash = ""
    mockFetch({})
    renderSignedIn(<VerifyPage />)
    expect(
      await screen.findByRole("textbox", { name: "Email" }),
    ).toBeInTheDocument()
  })
})
