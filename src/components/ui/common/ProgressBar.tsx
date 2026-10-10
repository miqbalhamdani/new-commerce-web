import { cx } from "@/lib/utils"

/** The brand progress bar: a native <progress> repainted. */
export function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number
  max: number
  label: string
  className?: string
}) {
  return (
    <progress
      className={cx(
        "h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-500 [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-value]:bg-brand-500 dark:[&::-webkit-progress-bar]:bg-gray-800",
        className,
      )}
      value={value}
      max={max}
      aria-label={label}
    />
  )
}
