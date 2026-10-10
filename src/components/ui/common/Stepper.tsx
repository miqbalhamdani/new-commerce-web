/** Numbered circles with connectors (TailAdmin ships no stepper): done is
    brand-filled, current is brand-ringed, the rest wait in gray. */
export function Stepper({
  steps,
  current,
}: {
  steps: readonly string[]
  current: number
}) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-3" aria-label="Steps">
      {steps.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "step" : undefined}
          className="flex items-center gap-3"
        >
          {i > 0 && (
            <span aria-hidden className="h-px w-8 bg-gray-200 dark:bg-gray-800" />
          )}
          <span className="flex items-center gap-2 text-theme-sm">
            <span
              className={
                i < current
                  ? "flex size-8 items-center justify-center rounded-full bg-brand-500 text-white"
                  : i === current
                    ? "flex size-8 items-center justify-center rounded-full text-brand-500 ring-2 ring-inset ring-brand-500"
                    : "flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"
              }
            >
              {i + 1}
            </span>
            <span
              className={
                i === current
                  ? "font-medium text-gray-800 dark:text-white/90"
                  : "text-gray-500 dark:text-gray-400"
              }
            >
              {label}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
