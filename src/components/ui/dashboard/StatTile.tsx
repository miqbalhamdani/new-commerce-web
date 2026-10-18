import Link from "next/link"

/**
 * A count that opens the list behind it, in TailAdmin's logistics-tile shape
 * (P1-114, needs action): the icon in its square, then the number over its
 * label. A badge beside the label adds what the staff should do about it; it
 * is never a made-up change, since these counts are the shop now.
 */
export function StatTile({
  label,
  value,
  icon,
  href,
  badge,
}: {
  label: string
  value: string
  icon: React.ReactNode
  /** The whole tile opens this list. */
  href: string
  /** Short, to sit beside the label; title says it in full on hover. */
  badge?: { text: string; title: string }
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-800"
    >
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white/90"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-title-sm font-bold text-gray-800 dark:text-white/90">
          {value}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-theme-sm text-gray-500 dark:text-gray-400">
            {label}
          </span>
          {badge && (
            <span
              title={badge.title}
              className="whitespace-nowrap rounded-full bg-warning-50 px-2.5 py-0.5 text-theme-xs font-medium text-warning-600 dark:bg-warning-500/15 dark:text-orange-400"
            >
              {badge.text}
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}
