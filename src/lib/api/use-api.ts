"use client"

import { useCallback, useEffect, useState } from "react"

import { apiFetch, ApiError } from "@/lib/api/client"
import { useSession } from "@/lib/auth/session"

type Options = Parameters<typeof apiFetch>[2]

/** apiFetch bound to the current session. */
export function useApi() {
  const { getAccessToken, refresh } = useSession()
  return useCallback(
    <T,>(path: string, options?: Options) =>
      apiFetch<T>(path, { getAccessToken, refresh }, options),
    [getAccessToken, refresh],
  )
}

/**
 * Loads one resource and keeps it in state. A null path loads nothing, for
 * a page still waiting on something it needs first.
 *
 * The access token lives only in client memory (BR-022), so pages fetch in
 * the browser; reload() re-runs the request after a write.
 */
export function useResource<T>(path: string | null) {
  const api = useApi()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    setLoading(true)
    api<T>(path)
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(asApiError(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [api, path, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, setData, error, loading, reload }
}

/** Any thrown value as an ApiError, so error views have one shape to show. */
export function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  return new ApiError({
    type: "about:blank",
    title: "Request failed",
    status: 0,
    detail: e instanceof Error ? e.message : "The request did not complete.",
    trace_id: "",
  })
}

/** The message a field-level error names, if the problem has one for it. */
export function fieldError(error: ApiError | null, field: string): string | undefined {
  const e = error?.problem.errors?.find((x) => x.field === field)
  return e ? (e.detail ?? error?.message) : undefined
}
