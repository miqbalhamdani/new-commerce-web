"use client"

import { Switch } from "@headlessui/react"

import { cx } from "@/lib/utils"

/**
 * An on/off switch. Headless UI's Switch, not the vendored TailAdmin one
 * (PATCHES.md): it is a real switch role with keyboard support. label is its
 * accessible name; the visible label is the caller's.
 */
export function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <Switch
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className={cx(
        "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-gray-200 transition-colors dark:bg-white/10",
        "data-[checked]:bg-brand-500 dark:data-[checked]:bg-brand-500",
        "focus:outline-none data-[focus]:ring-2 data-[focus]:ring-brand-500/30",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none mt-0.5 size-5 translate-x-0.5 rounded-full bg-white shadow-theme-xs transition-transform group-data-[checked]:translate-x-[1.375rem]"
      />
    </Switch>
  )
}
