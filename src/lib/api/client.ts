import type { components } from "@/lib/api/schema";

export type Problem = components["schemas"]["Problem"];

/**
 * An API call that failed, carrying the RFC 9457 body the server sent.
 *
 * `traceId` is the reason to keep the whole problem rather than just a message:
 * quoting it in a support ticket lands an engineer on the exact request. It
 * belongs somewhere a user can copy -- see the error views.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly traceId: string;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.problem = problem;
    this.status = problem.status;
    this.traceId = problem.trace_id;
    // The code is the last segment of the type URI; the API sends no separate
    // field for it (API spec.md 1.1).
    this.code = problem.type.split("/").pop() ?? "unknown";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Calls the API with the current access token, refreshing once if it has
 * expired.
 *
 * Takes the two session functions as arguments rather than importing the
 * session: this module has no React in it, so it can be tested without
 * rendering anything.
 *
 * Everything goes to a relative path. The browser only ever talks to this
 * origin -- Caddy proxies /v1/* to the API in production and next.config.ts
 * does the same locally -- which is what lets the refresh cookie work with no
 * CORS anywhere.
 */
export async function apiFetch<T>(
  path: string,
  session: {
    getAccessToken(): string | null;
    refresh(): Promise<string | null>;
  },
  options: RequestOptions = {},
): Promise<T> {
  const send = (token: string | null) => {
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(path, {
      ...options,
      headers,
      credentials: "include",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  };

  let response = await send(session.getAccessToken());

  // One retry, and only on 401. An access token lasts 15 minutes, so an
  // expired one is ordinary rather than exceptional. Retrying more than once,
  // or on any other status, turns a permanent failure into a loop.
  if (response.status === 401) {
    const refreshed = await session.refresh();
    if (refreshed) {
      response = await send(refreshed);
    }
  }

  if (!response.ok) {
    throw new ApiError(await readProblem(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Reads the error body, falling back to a synthetic one.
 *
 * A gateway timeout or a proxy error is not written by our API and will not be
 * problem+json, so the callers below must still get an ApiError rather than a
 * parse failure.
 */
async function readProblem(response: Response): Promise<Problem> {
  try {
    const body = (await response.json()) as Problem;
    if (typeof body?.status === "number" && typeof body?.trace_id === "string") {
      return body;
    }
  } catch {
    // fall through
  }
  return {
    type: "about:blank",
    title: "Request failed",
    status: response.status,
    detail: `The server responded with ${response.status}.`,
    trace_id: "",
  };
}
