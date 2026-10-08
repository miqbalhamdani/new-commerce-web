import { cx, focusInput, focusRing, hasErrorInput } from "@/lib/utils"

/** A labelled control with its error under it. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-gray-50">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function Textarea({ className, hasError, ...props }: React.ComponentProps<"textarea"> & { hasError?: boolean }) {
  return (
    <textarea
      className={cx(
        "w-full rounded-md border px-2.5 py-2 text-sm shadow-sm outline-none",
        "border-gray-300 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
        focusInput,
        hasError && hasErrorInput,
        className,
      )}
      {...props}
    />
  )
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cx("size-4 rounded border-gray-300 text-blue-600 dark:border-gray-700", focusRing, className)}
      {...props}
    />
  )
}

/** A native select styled like the inputs; enough for a short list. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cx(
        "h-9 rounded-md border px-2.5 text-sm shadow-sm outline-none",
        "border-gray-300 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
        focusInput,
        className,
      )}
      {...props}
    />
  )
}
