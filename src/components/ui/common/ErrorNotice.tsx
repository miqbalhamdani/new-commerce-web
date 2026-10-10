import type { ApiError } from "@/lib/api/client"

/**
 * An API error a person can act on: the detail the server wrote, and the
 * trace id, copyable, so a support ticket lands on the exact request
 * (04-api-spec.md §1.1). Styled like the vendored Alert's error variant.
 */
export function ErrorNotice({ error, title = "Something went wrong" }: { error: ApiError | null; title?: string }) {
  if (!error) return null
  return (
    <div
      role="alert"
      className="rounded-xl border border-error-500 bg-error-50 p-4 text-theme-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
    >
      <p>
        <span className="font-medium">{title}. </span>
        {error.message}
      </p>
      {error.traceId && (
        <p className="mt-1 text-xs opacity-80">
          Reference <code className="select-all font-mono">{error.traceId}</code>
        </p>
      )}
    </div>
  )
}
