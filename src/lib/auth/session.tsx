"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { components } from "@/lib/api/schema";

type Session = components["schemas"]["Session"];
export type SessionUser = components["schemas"]["SessionUser"];
export type SessionTenant = components["schemas"]["SessionTenant"];

/**
 * The signed-in session.
 *
 * P1-014's acceptance is the shape of this file: the access token lives in
 * memory and the refresh token lives in an httpOnly cookie. Neither ever
 * touches localStorage or sessionStorage -- anything readable by a script on
 * the page is readable by a script that should not be on the page, and an XSS
 * that can read a token can use it from anywhere for its full lifetime.
 *
 * Holding it in memory means it is gone on reload, which is not a gap: reload
 * calls refresh, the cookie proves who you are, and a new access token comes
 * back. The cookie survives precisely because the page cannot read it.
 */
interface SessionState {
  user: SessionUser | null;
  tenant: SessionTenant | null;
  /** Null until the first refresh finishes, so nothing renders a signed-out shell first. */
  status: "loading" | "authenticated" | "anonymous";
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Reads the current access token. A function, not a value -- see below. */
  getAccessToken(): string | null;
  /** Exchanges the cookie for a new access token. Returns null when there is no session. */
  refresh(): Promise<string | null>;
}

const SessionContext = createContext<SessionState | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return session;
}

/** Thrown by signIn when the credentials are refused. */
export class AuthError extends Error {}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenant, setTenant] = useState<SessionTenant | null>(null);
  const [status, setStatus] = useState<SessionState["status"]>("loading");

  /**
   * The access token is a ref, not state, for two reasons.
   *
   * Rendering it would put it in the React tree, where a devtools inspection or
   * a serialised error boundary can surface it. And a token that changes on
   * every refresh would re-render every consumer of this context for a value
   * none of them display.
   */
  const accessToken = useRef<string | null>(null);

  const adopt = useCallback((session: Session) => {
    accessToken.current = session.access_token;
    setUser(session.user);
    setTenant(session.tenant);
    setStatus("authenticated");
  }, []);

  const forget = useCallback(() => {
    accessToken.current = null;
    setUser(null);
    setTenant(null);
    setStatus("anonymous");
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/v1/auth/refresh", {
      method: "POST",
      // Without this the browser does not attach the cookie and refresh always
      // fails -- silently, with a 401 that looks like an expired session.
      credentials: "include",
    });
    if (!response.ok) {
      forget();
      return null;
    }
    const session = (await response.json()) as Session;
    adopt(session);
    return session.access_token;
  }, [adopt, forget]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response = await fetch("/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        // The API deliberately returns the same answer for a wrong password, an
        // unknown email and a disabled account. Surfacing its detail verbatim
        // keeps it that way instead of inventing a more specific message.
        const problem = await response.json().catch(() => null);
        throw new AuthError(problem?.detail ?? "Could not sign in.");
      }
      adopt((await response.json()) as Session);
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    const token = accessToken.current;
    // Best effort. If this fails the local session still ends -- leaving the
    // user signed in because the server did not answer is the wrong failure.
    await fetch("/v1/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).catch(() => undefined);
    forget();
  }, [forget]);

  // One refresh on mount. This is what makes a reload keep you signed in: the
  // access token is gone, the cookie is not.
  //
  // The set-state-in-effect rule is disabled below, deliberately. Its own
  // message is "calling setState SYNCHRONOUSLY within an effect", and nothing
  // here does: refresh is async and its first statement is an await, so state
  // is only ever set after the network answers. The rule cannot see across the
  // function boundary.
  //
  // Nor is there a version of this without an effect. refresh is a POST that
  // rotates the stored token -- a mutation that must happen exactly once, on
  // the client, after mount. It cannot move into a Server Component, because
  // rendering is not allowed to rotate a credential, and it cannot be derived
  // from anything, because its only input is a cookie this code may not read.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    refresh().catch(() => {
      if (!cancelled) forget();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, forget]);

  const value = useMemo<SessionState>(
    () => ({
      user,
      tenant,
      status,
      signIn,
      signOut,
      refresh,
      getAccessToken: () => accessToken.current,
    }),
    [user, tenant, status, signIn, signOut, refresh],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

/** Whether the signed-in user's role grants a permission. */
export function useCan(permission: string) {
  const { user } = useSession();
  return user?.permissions.includes(permission) ?? false;
}
