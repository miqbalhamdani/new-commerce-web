import Link from "next/link"

/**
 * A count that opens the list behind it, TailAdmin's metric tile: label and
 * icon, the number, one line saying what it counts (P1-114, needs action).
 */
export function StatTile({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  /** The whole tile opens this list. */
  href: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 md:p-6 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-800"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white/90"
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-title-sm font-bold text-gray-800 dark:text-white/90">
        {value}
      </p>
      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
        {sub}
      </p>
    </Link>
  )
}
