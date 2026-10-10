"use client"

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react"

import { CheckLineIcon, ChevronDownIcon } from "@/icons"
import { cx } from "@/lib/utils"

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
  /** Indents the option in the panel (a tree); the trigger shows it flat. */
  depth?: number
}

/* ListboxButton computes aria-describedby from its own Description context,
   discarding the prop; re-apply ours after Headless UI's spread. */
function TriggerButton({
  describedBy,
  ...props
}: React.ComponentProps<"button"> & { describedBy?: string }) {
  return <button {...props} aria-describedby={describedBy} />
}

/**
 * The select: a Headless UI Listbox in the TailAdmin input skin. Controlled
 * like a native select (string value in, string value out), options as a flat
 * array — no site needs groups or a placeholder, every "" option is a legal
 * choice ("All brands", "Ignore", ...).
 *
 * The options panel is portalled (anchor prop): table shells clip
 * inline-absolute panels, so it must float — and therefore sit above the
 * Modal's z-99999.
 */
export function Select({
  value,
  onChange,
  options,
  id,
  disabled,
  error,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  id?: string
  disabled?: boolean
  error?: boolean
  size?: "sm" | "md"
  className?: string
  "aria-label"?: string
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <ListboxButton
        as={TriggerButton}
        id={id}
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        describedBy={error && id ? `${id}-error` : undefined}
        className={cx(
          "inline-flex cursor-pointer items-center justify-between gap-2 rounded-lg border bg-transparent px-3 text-start text-sm shadow-theme-xs",
          "focus:outline-none focus:ring data-[open]:ring",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60",
          size === "sm" ? "h-9" : "h-11",
          error
            ? "border-error-500 text-error-800 focus:ring-error-500/10 dark:border-error-500 dark:text-error-400"
            : "border-gray-300 text-gray-800 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800",
          "dark:bg-gray-900",
          className,
        )}
      >
        {/* Every label is stacked invisibly in the same grid cell so the
            trigger keeps the width of the widest option, like a native
            select, instead of resizing on each pick. The text lives in a
            ::before/attr() so it still takes up width but stays out of
            textContent — the trigger's text is the selected label alone. */}
        <span className="grid overflow-hidden">
          <span className="col-start-1 row-start-1 truncate">
            {selected?.label ?? " "}
          </span>
          {options.map((o) => (
            <span
              key={o.value}
              aria-hidden
              data-label={o.label}
              className="invisible col-start-1 row-start-1 truncate before:content-[attr(data-label)]"
            />
          ))}
        </span>
        <ChevronDownIcon
          aria-hidden
          className="size-4 shrink-0 text-gray-500 dark:text-gray-400"
        />
      </ListboxButton>
      <ListboxOptions
        anchor="bottom start"
        className={cx(
          "z-999999 w-max min-w-[var(--button-width)] max-w-80 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-theme-lg",
          "focus:outline-none dark:border-gray-800 dark:bg-gray-dark",
          "[--anchor-gap:4px] [--anchor-max-height:20rem]",
        )}
      >
        {options.map((o) => (
          <ListboxOption
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className="group flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-gray-700 data-[disabled]:cursor-not-allowed data-[focus]:bg-gray-100 data-[disabled]:opacity-50 dark:text-gray-300 dark:data-[focus]:bg-white/5"
          >
            <span
              className="truncate"
              style={o.depth ? { paddingLeft: o.depth * 16 } : undefined}
            >
              {o.label}
            </span>
            <CheckLineIcon
              aria-hidden
              className="invisible size-4 shrink-0 text-brand-500 group-data-[selected]:visible"
            />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  )
}

/**
 * Pick several: the same Listbox skin with `multiple`, each option a
 * checkbox. The panel stays open between picks; the trigger lists what is
 * picked.
 */
export function MultiSelect({
  value,
  onChange,
  options,
  id,
  disabled,
  error,
  placeholder = "None",
  "aria-label": ariaLabel,
}: {
  value: string[]
  onChange: (value: string[]) => void
  options: readonly SelectOption[]
  id?: string
  disabled?: boolean
  error?: boolean
  placeholder?: string
  "aria-label"?: string
}) {
  const picked = options.filter((o) => value.includes(o.value))
  return (
    <Listbox value={value} onChange={onChange} disabled={disabled} multiple>
      <ListboxButton
        as={TriggerButton}
        id={id}
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        describedBy={error && id ? `${id}-error` : undefined}
        className={cx(
          "flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-transparent px-3 text-start text-sm shadow-theme-xs",
          "focus:outline-none focus:ring data-[open]:ring",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60",
          error
            ? "border-error-500 text-error-800 focus:ring-error-500/10 dark:border-error-500 dark:text-error-400"
            : "border-gray-300 text-gray-800 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800",
          "dark:bg-gray-900",
        )}
      >
        <span
          className={cx(
            "truncate",
            picked.length === 0 && "text-gray-400 dark:text-gray-500",
          )}
        >
          {picked.length ? picked.map((o) => o.label).join(", ") : placeholder}
        </span>
        <ChevronDownIcon
          aria-hidden
          className="size-4 shrink-0 text-gray-500 dark:text-gray-400"
        />
      </ListboxButton>
      <ListboxOptions
        anchor="bottom start"
        className={cx(
          "z-999999 w-max min-w-[var(--button-width)] max-w-80 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-theme-lg",
          "focus:outline-none dark:border-gray-800 dark:bg-gray-dark",
          "[--anchor-gap:4px] [--anchor-max-height:20rem]",
        )}
      >
        {options.map((o) => (
          <ListboxOption
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className="group flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-gray-700 data-[disabled]:cursor-not-allowed data-[focus]:bg-gray-100 data-[disabled]:opacity-50 dark:text-gray-300 dark:data-[focus]:bg-white/5"
            style={o.depth ? { paddingLeft: 12 + o.depth * 16 } : undefined}
          >
            <span
              aria-hidden
              className="flex size-4 shrink-0 items-center justify-center rounded border border-gray-300 group-data-[selected]:border-brand-500 group-data-[selected]:bg-brand-500 dark:border-gray-700"
            >
              <CheckLineIcon className="invisible size-3 text-white group-data-[selected]:visible" />
            </span>
            <span className="truncate">{o.label}</span>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  )
}
