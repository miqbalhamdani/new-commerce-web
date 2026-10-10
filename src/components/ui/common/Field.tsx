import Label from "@/components/form/Label"
import { cx } from "@/lib/utils"

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
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-error-500">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
    </div>
  )
}

/* The three native controls below carry the vendored InputField's classes but
   keep their native prop shape: the vendored TextArea and Select funnel
   onChange through (value: string) and cannot be controlled the way the forms
   here are. */

const fieldClasses = (hasError?: boolean) =>
  cx(
    "w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm shadow-theme-xs",
    "placeholder:text-gray-400 focus:outline-none focus:ring dark:bg-gray-900 dark:placeholder:text-white/30",
    hasError
      ? "border-error-500 text-error-800 focus:ring-error-500/10 dark:border-error-500 dark:text-error-400"
      : "border-gray-300 text-gray-800 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800",
  )

export function Textarea({
  className,
  hasError,
  ...props
}: React.ComponentProps<"textarea"> & { hasError?: boolean }) {
  return (
    <textarea
      aria-invalid={hasError || undefined}
      className={cx(fieldClasses(hasError), className)}
      {...props}
    />
  )
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cx(
        "size-4 rounded border-gray-300 text-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-800",
        className,
      )}
      {...props}
    />
  )
}

/** A native select styled like the inputs; enough for a short list. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cx(
        "h-11 rounded-lg border border-gray-300 bg-transparent px-3 pr-8 text-sm text-gray-800 shadow-theme-xs",
        "focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10",
        "dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800",
        className,
      )}
      {...props}
    />
  )
}
