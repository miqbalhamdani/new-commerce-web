import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import TeamPage from "@/app/(app)/settings/team/page"
import { json, mockApi, renderSignedIn } from "@/test/api"

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/team",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

beforeEach(() => vi.unstubAllGlobals())

const yusuf = {
  id: "u2",
  email: "yusuf@example.com",
  name: "Yusuf",
  role: "admin",
  status: "active",
  bio: null,
  last_login_at: null,
  created_at: "2026-10-06T16:15:00+07:00",
}

describe("the team screen's bio (P1-608)", () => {
  it("sets the line shown under someone's blog posts (BR-133)", async () => {
    const fetchSpy = mockApi(["users:read", "users:write"], (url, init) => {
      if (url.endsWith("/v1/users/u2") && init?.method === "PATCH")
        return json({ ...yusuf, bio: "Writes the journal." })
      if (url.includes("/v1/users"))
        return json({ data: [yusuf], next_cursor: null })
      if (url.endsWith("/v1/roles")) return json([])
      return undefined
    })
    renderSignedIn(<TeamPage />)

    await screen.findByText("Yusuf")
    await userEvent.click(screen.getByRole("button", { name: "Bio" }))
    await userEvent.type(screen.getByLabelText("Bio"), "  Writes the journal. ")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      const patch = fetchSpy.mock.calls.find(
        ([u, i]) => String(u).endsWith("/v1/users/u2") && i?.method === "PATCH",
      )
      expect(JSON.parse(String(patch![1]!.body))).toEqual({
        bio: "Writes the journal.",
      })
    })
  })

  it("a reader gets no Bio button", async () => {
    mockApi(["users:read"], (url) => {
      if (url.includes("/v1/users"))
        return json({ data: [yusuf], next_cursor: null })
      if (url.endsWith("/v1/roles")) return json([])
      return undefined
    })
    renderSignedIn(<TeamPage />)
    await screen.findByText("Yusuf")
    expect(screen.queryByRole("button", { name: "Bio" })).toBeNull()
  })
})
