import { cx } from "@/lib/utils"

/** The two categorical slots as fills, in fixed order (see Chart.tsx). */
const fills = ["bg-brand-500", "bg-orange-500 dark:bg-orange-600"]

/**
 * A whole split in two, as one bar with its parts named and counted under it
 * (P1-114). Two parts read better as a bar than a two-slice donut, and the
 * numbers beside each colour mean no one needs the colour to read it.
 */
export function ShareBar({
  label,
  parts,
  empty,
}: {
  /** Names the bar for screen readers: "Sales by channel". */
  label: string
  parts: { name: string; value: number; detail: string }[]
  /** Said in place of the bar when every part is zero. */
  empty: string
}) {
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  if (total === 0) {
    return (
      <p className="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
        {empty}
      </p>
    )
  }
  const share = (v: number) => Math.round((v / total) * 100)
  return (
    <div>
      <div
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.name} ${share(p.value)}%`).join(", ")}`}
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
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
      <ul className="mt-4 space-y-3">
        {parts.map((p, i) => (
          <li
            key={p.name}
            className="flex items-center justify-between gap-3 text-theme-sm"
          >
            <span className="flex min-w-0 items-center gap-2 text-gray-700 dark:text-gray-300">
              <span
                aria-hidden
                className={cx("size-2.5 shrink-0 rounded-full", fills[i])}
              />
              {p.name}
            </span>
            <span className="text-right text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-800 dark:text-white/90">
                {share(p.value)}%
              </span>
              {" · "}
              {p.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
