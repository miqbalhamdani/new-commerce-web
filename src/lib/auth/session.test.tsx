import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider, useSession } from "@/lib/auth/session";

/**
 * P1-014's acceptance: the access token is in memory, the refresh token is in
 * an httpOnly cookie.
 *
 * The second half cannot be asserted from here on purpose -- an httpOnly cookie
 * is invisible to script, which is the entire point of it. What this file can
 * prove is the part that is script's responsibility: the token never reaches
 * any storage a script can read, and every call opts in to sending cookies so
 * the browser can attach one it will not show us.
 */

const session = {
  access_token: "test-access-token",
  expires_in: 900,
  user: { id: "u1", name: "Budi", role: "ops", permissions: ["products:read"] },
  tenant: { id: "t1", name: "Erigo", timezone: "Asia/Jakarta", currency: "IDR" },
};

function Probe() {
  const { status, user, getAccessToken, signIn, signOut } = useSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.name ?? "-"}</span>
      <span data-testid="token">{getAccessToken() ?? "-"}</span>
      <button onClick={() => void signIn("ops@erigo.co.id", "hunter2hunter2")}>
        sign in
      </button>
      <button onClick={() => void signOut()}>sign out</button>
    </div>
  );
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const spy = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
    handler(String(url), init),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("session", () => {
  it("holds the access token in memory and nowhere a script can read", async () => {
    mockFetch((url) =>
      url.endsWith("/v1/auth/login") ? json(session) : json({}, 401),
    );

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("anonymous"),
    );

    await userEvent.click(screen.getByRole("button", { name: "sign in" }));
    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent("test-access-token"),
    );

    // The acceptance, in the only form a test can check it. A token in either
    // store survives a tab close and is readable by any script on the page,
    // including one that should not be there.
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(JSON.stringify(window.localStorage)).not.toContain("test-access-token");
    expect(document.cookie).not.toContain("test-access-token");
  });

  it("sends credentials on every auth call so the browser attaches the cookie", async () => {
    const fetchSpy = mockFetch((url) =>
      url.endsWith("/v1/auth/login") ? json(session) : json({}, 401),
    );

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => screen.getByTestId("status"));
    await userEvent.click(screen.getByRole("button", { name: "sign in" }));

    // Without credentials: "include" the cookie is silently not attached, and
    // refresh fails with a 401 that looks exactly like an expired session.
    for (const [, init] of fetchSpy.mock.calls) {
      expect(init?.credentials).toBe("include");
    }
  });

  it("calls a relative path, never the API origin directly", async () => {
    const fetchSpy = mockFetch(() => json({}, 401));

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => screen.getByTestId("status"));

    // One origin is what lets a SameSite=Lax cookie work with no CORS. A call
    // to http://localhost:8080 would need both.
    for (const [url] of fetchSpy.mock.calls) {
      expect(String(url)).toMatch(/^\/v1\//);
    }
  });

  it("never runs two refreshes at once", async () => {
    // Refresh rotates the stored token, so a second concurrent call presents
    // one the first already rotated away -- which the API reads as theft and
    // answers by ending every session. StrictMode double-invokes mount effects,
    // so without single-flighting this signed the user out on every reload.
    const fetchSpy = mockFetch((url) =>
      url.endsWith("/v1/auth/refresh") ? json(session) : json({}, 401),
    );

    function Twice() {
      const { refresh } = useSession();
      return (
        <button
          onClick={() => {
            void refresh();
            void refresh();
          }}
        >
          refresh twice
        </button>
      );
    }

    render(
      <SessionProvider>
        <Twice />
      </SessionProvider>,
    );
    await waitFor(() => screen.getByRole("button"));

    const before = fetchSpy.mock.calls.filter(([url]) =>
      String(url).endsWith("/v1/auth/refresh"),
    ).length;
    await userEvent.click(screen.getByRole("button", { name: "refresh twice" }));

    const after = fetchSpy.mock.calls.filter(([url]) =>
      String(url).endsWith("/v1/auth/refresh"),
    ).length;
    expect(after - before).toBe(1);
  });

  it("restores the session on load from the cookie alone", async () => {
    // The reload case: no access token in memory, only the cookie. If this did
    // not work, every refresh of the page would sign the user out.
    mockFetch((url) =>
      url.endsWith("/v1/auth/refresh") ? json(session) : json({}, 401),
    );

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );
    expect(screen.getByTestId("user")).toHaveTextContent("Budi");
    expect(screen.getByTestId("token")).toHaveTextContent("test-access-token");
  });

  it("ends the session locally even when logout fails", async () => {
    mockFetch((url) => {
      if (url.endsWith("/v1/auth/login")) return json(session);
      if (url.endsWith("/v1/auth/logout")) throw new Error("network down");
      return json({}, 401);
    });

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => screen.getByTestId("status"));
    await userEvent.click(screen.getByRole("button", { name: "sign in" }));
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated"),
    );

    await userEvent.click(screen.getByRole("button", { name: "sign out" }));

    // Leaving someone signed in because the server did not answer is the wrong
    // failure to choose.
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("anonymous"),
    );
    expect(screen.getByTestId("token")).toHaveTextContent("-");
  });

  it("surfaces the API's own message rather than inventing one", async () => {
    mockFetch((url) =>
      url.endsWith("/v1/auth/login")
        ? json(
            {
              type: "https://docs.example.com/errors/unauthenticated",
              title: "Unauthenticated",
              status: 401,
              detail: "Email or password is incorrect.",
              trace_id: "abc123",
            },
            401,
          )
        : json({}, 401),
    );

    function Failing() {
      const { signIn } = useSession();
      return (
        <button
          onClick={() =>
            void signIn("nobody@example.com", "wrongwrong").catch((err: Error) => {
              document.title = err.message;
            })
          }
        >
          try
        </button>
      );
    }

    render(
      <SessionProvider>
        <Failing />
      </SessionProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "try" }));

    // The API answers identically for a wrong password, an unknown email and a
    // disabled account. Writing a friendlier, more specific message here would
    // undo that on the client.
    await waitFor(() =>
      expect(document.title).toBe("Email or password is incorrect."),
    );
  });
});
