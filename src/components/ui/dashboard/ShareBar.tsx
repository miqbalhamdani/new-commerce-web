import { cx } from "@/lib/utils"

/** Each part's fill, in order. */
const fills = ["bg-brand-400", "bg-blue-light-300"]

/**
 * A whole and its parts as TailAdmin's "Spending" card (P1-114): the total,
 * one segmented bar, and the parts named under it with their counts, so no
 * one needs the colours to read it.
 */
export function ShareBar({
  label,
  total,
  parts,
  empty,
}: {
  /** Names the bar for screen readers: "Customers". */
  label: string
  /** The whole, written big above the bar. */
  total: string
  parts: { name: string; value: number; detail: string }[]
  /** Said in place of the bar when every part is zero. */
  empty: string
}) {
  const sum = parts.reduce((s, p) => s + p.value, 0)
  if (sum === 0) {
    return (
      <p className="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
        {empty}
      </p>
    )
  }
  const share = (v: number) => Math.round((v / sum) * 100)
  return (
    <div>
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">Total</p>
      <p className="mt-1 text-title-sm font-bold text-gray-800 dark:text-white/90">
        {total}
      </p>
      <div
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.name} ${share(p.value)}%`).join(", ")}`}
        className="mt-5 flex h-7 gap-0.5 overflow-hidden rounded-lg"
      >
        {parts.map((p, i) =>
          p.value > 0 ? (
            // Grown by value from a zero basis, so the 2px gap between parts
            // comes out of the parts rather than overflowing the track.
            <div
              key={p.name}
              className={cx("h-full", fills[i])}
              style={{ flex: `${p.value} 1 0%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-5 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {parts.map((p, i) => (
          <li key={p.name} className="flex items-center gap-2 text-theme-sm">
            <span
              aria-hidden
              className={cx("size-2.5 shrink-0 rounded-full", fills[i])}
            />
            <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {p.detail} ({share(p.value)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
