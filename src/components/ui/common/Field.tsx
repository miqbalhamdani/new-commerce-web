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

/* The native controls below carry the vendored InputField's classes but keep
   their native prop shape: the vendored TextArea and Checkbox funnel onChange
   through a plain value and cannot be controlled the way the forms here are.
   Selects live in ui/common/Select.tsx (Headless UI). */

export const fieldClasses = (hasError?: boolean) =>
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

/** Custom-drawn box, but the real input IS the box: role, .checked, label
    clicks and keyboard stay native; only the paint is ours. A "some
    selected" box sets the input's indeterminate through a ref. */
export function Checkbox({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <span className={cx("relative inline-flex size-4 shrink-0", className)}>
      <input
        type="checkbox"
        className={cx(
          "peer size-4 cursor-pointer appearance-none rounded border border-gray-300 bg-transparent transition-colors",
          "checked:border-brand-500 checked:bg-brand-500 indeterminate:border-brand-500 indeterminate:bg-brand-500",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "dark:border-gray-700 dark:bg-gray-900 dark:checked:border-brand-500 dark:checked:bg-brand-500",
        )}
        {...props}
      />
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        fill="none"
        className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-white peer-checked:block"
      >
        <path
          d="M2.5 6.5L4.75 8.75L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        fill="none"
        className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-white peer-indeterminate:block"
      >
        <path
          d="M3 6h6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
