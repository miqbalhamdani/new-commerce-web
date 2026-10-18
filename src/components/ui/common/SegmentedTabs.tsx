import { cx } from "@/lib/utils"

/**
 * A segmented control: equal-width options on a gray track, the chosen one a
 * filled brand chip. Buttons with aria-pressed, so each reads as a toggle.
 *
 * `underline` is the same control as a card's header: plain labels sitting on
 * the card's divider, the chosen one underlined in brand, so the tabs read as
 * part of the table below rather than a control floating above it. Its parent
 * draws the divider (border-b) and gives no vertical padding.
 *
 * `subtle` is TailAdmin's table-header tabs: the same gray track, the chosen
 * one a white chip, for filters that sit inside a card (P1-114).
 */
export function SegmentedTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  variant = "segmented",
}: {
  /** Names the group for screen readers ("Saved views", "Tree"). */
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  variant?: "segmented" | "underline" | "subtle"
}) {
  const underline = variant === "underline"
  const subtle = variant === "subtle"
  return (
    <div className="max-w-full overflow-x-auto">
      <div
        role="group"
        aria-label={label}
        // minmax keeps a label from shrinking under its text when the track
        // overflows and scrolls; plain 1fr lets the columns collapse there.
        className={
          underline
            ? "flex gap-6"
            : "inline-grid auto-cols-[minmax(max-content,1fr)] grid-flow-col gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1 dark:border-gray-800 dark:bg-gray-900"
        }
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              "whitespace-nowrap text-theme-sm font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
              underline
                ? // The 2px bar lands on the parent's divider, joining the
                  // chosen tab to the rows under it.
                  cx(
                    "border-b-2 px-1 py-4",
                    value === o.value
                      ? "border-brand-500 text-brand-500 dark:text-brand-400"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white/90",
                  )
                : subtle
                  ? cx(
                      "rounded-lg px-3 py-2",
                      value === o.value
                        ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                    )
                  : cx(
                      "rounded-lg px-5 py-2",
                      // The chosen one is filled brand so it reads at a glance;
                      // the rest stay dark enough to read, not greyed out.
                      value === o.value
                        ? "bg-brand-500 text-white shadow-theme-xs"
                        : "text-gray-700 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white",
                    ),
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
