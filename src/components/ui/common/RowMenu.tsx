"use client"

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSeparator,
} from "@headlessui/react"

import { MoreDotIcon } from "@/icons"
import { cx } from "@/lib/utils"

export type RowAction = {
  label: string
  icon?: React.ReactNode
  onSelect: () => void
  /** Red, and set apart below a separator: Delete, Remove, Revoke. */
  destructive?: boolean
}

/**
 * A row's actions behind a three-dot button: a Headless UI Menu in the
 * TailAdmin dropdown skin. The panel is portalled (anchor prop) for the same
 * reason as Select: table shells clip inline-absolute panels.
 *
 * Clicks stop here, so a clickable row does not also fire when an action is
 * picked (React events bubble through the portal to the row).
 */
export function RowMenu({
  label,
  actions,
}: {
  /** Names the trigger: "Actions for Erigo". */
  label: string
  actions: readonly RowAction[]
}) {
  const safe = actions.filter((a) => !a.destructive)
  const destructive = actions.filter((a) => a.destructive)
  return (
    <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <Menu>
        <MenuButton
          aria-label={label}
          className={cx(
            "inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors",
            "hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30",
            "data-[open]:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white/90 dark:data-[open]:bg-white/5",
          )}
        >
          <MoreDotIcon aria-hidden className="size-5" />
        </MenuButton>
        <MenuItems
          anchor="bottom end"
          className={cx(
            "z-999999 min-w-40 rounded-xl border border-gray-200 bg-white p-1 shadow-theme-lg",
            "focus:outline-none dark:border-gray-800 dark:bg-gray-dark",
            "[--anchor-gap:4px]",
          )}
        >
          {safe.map((a) => (
            <Item key={a.label} action={a} />
          ))}
          {safe.length > 0 && destructive.length > 0 && (
            <MenuSeparator className="my-1 h-px bg-gray-100 dark:bg-white/[0.05]" />
          )}
          {destructive.map((a) => (
            <Item key={a.label} action={a} />
          ))}
        </MenuItems>
      </Menu>
    </div>
  )
}

function Item({ action }: { action: RowAction }) {
  return (
    <MenuItem>
      <button
        type="button"
        onClick={action.onSelect}
        className={cx(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-theme-sm",
          action.destructive
            ? "text-error-600 data-[focus]:bg-error-50 dark:text-error-400 dark:data-[focus]:bg-error-500/10"
            : "text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-white/5",
        )}
      >
        {action.icon && (
          <span
            aria-hidden
            className="inline-flex size-4 shrink-0 [&>svg]:size-4"
          >
            {action.icon}
          </span>
        )}
        {action.label}
      </button>
    </MenuItem>
  )
}
