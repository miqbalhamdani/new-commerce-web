import type { ApiError } from "@/lib/api/client"

/**
 * An API error a person can act on: the detail the server wrote, and the
 * trace id, copyable, so a support ticket lands on the exact request
 * (04-api-spec.md §1.1).
 */
export function ErrorNotice({ error, title = "Something went wrong" }: { error: ApiError | null; title?: string }) {
  if (!error) return null
  return (
    <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/70 dark:text-red-400">
      <p>
        <span className="font-medium">{title}. </span>
        {error.message}
      </p>
      {error.traceId && (
        <p className="mt-1 text-xs opacity-80">
          Reference <code className="select-all">{error.traceId}</code>
        </p>
      )}
    </div>
  )
}
