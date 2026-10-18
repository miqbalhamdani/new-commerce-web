import { ArrowLeft, ArrowRight } from "lucide-react"

import Button from "@/components/ui/button/Button"
import { pageSpan, pageWindow } from "@/lib/pagination"
import { cx } from "@/lib/utils"

/**
 * A list's numbered pager (P1-232): "51–100 of 128", then previous, the page
 * numbers around the current one, and next. TailAdmin's table pagination look.
 * Shows nothing until there is a total to page through.
 */
export function Pager({
  page,
  limit,
  total,
  noun,
  onPage,
  className,
}: {
  page: number
  limit: number
  total: number | undefined
  /** What a row is, for the count and the nav label: "products". */
  noun: string
  onPage: (page: number) => void
  className?: string
}) {
  if (!total) return null
  const { from, to, pages } = pageSpan(page, limit, total)
  return (
    <nav
      aria-label={`${noun[0].toUpperCase()}${noun.slice(1)} pages`}
      className={cx(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">
        {from}–{to} of {total} {noun}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            startIcon={<ArrowLeft className="size-4" />}
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Previous
          </Button>
          <ul className="flex items-center gap-1">
            {pageWindow(page, pages).map((n, i) =>
              n === "…" ? (
                <li
                  key={`gap-${i}`}
                  className="px-1 text-theme-sm text-gray-400"
                >
                  …
                </li>
              ) : (
                <li key={n}>
                  <button
                    type="button"
                    aria-current={n === page ? "page" : undefined}
                    aria-label={`Page ${n}`}
                    onClick={() => onPage(n)}
                    className={cx(
                      "flex size-10 items-center justify-center rounded-lg text-theme-sm font-medium",
                      n === page
                        ? "bg-brand-500 text-white"
                        : "text-gray-700 hover:bg-brand-500/[0.08] hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-500",
                    )}
                  >
                    {n}
                  </button>
                </li>
              ),
            )}
          </ul>
          <Button
            size="sm"
            variant="outline"
            endIcon={<ArrowRight className="size-4" />}
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </nav>
  )
}
