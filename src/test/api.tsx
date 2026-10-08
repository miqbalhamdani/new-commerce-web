import { render } from "@testing-library/react"
import { vi } from "vitest"

import { SessionProvider } from "@/lib/auth/session"

/** A signed-in session as the refresh call returns it. */
export function sessionFor(permissions: string[], role = "admin") {
  return {
    access_token: "test-token",
    expires_in: 900,
    user: { id: "u1", name: "Budi", role, permissions },
    tenant: { id: "t1", name: "Erigo", timezone: "Asia/Jakarta" },
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

/**
 * Stubs fetch: the refresh on mount signs in with permissions, everything
 * else goes to handler. Returns the spy, so a test can read what was sent.
 */
export function mockApi(
  permissions: string[],
  handler: (url: string, init?: RequestInit) => Response | undefined,
  role = "admin",
) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/v1/auth/refresh"))
      return json(sessionFor(permissions, role))
    return (
      handler(url, init) ??
      json(
        { type: "about:blank", title: "Not found", status: 404, trace_id: "t" },
        404,
      )
    )
  })
  vi.stubGlobal("fetch", spy)
  return spy
}

/** Renders inside a session that has finished its first refresh. */
export function renderSignedIn(ui: React.ReactNode) {
  return render(<SessionProvider>{ui}</SessionProvider>)
}
