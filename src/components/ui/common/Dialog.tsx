"use client"

import * as D from "@radix-ui/react-dialog"

import { cx } from "@/lib/utils"

/** A centred modal on the installed Radix dialog. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/30 dark:bg-black/60" />
        <D.Content
          className={cx(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-950",
          )}
        >
          <D.Title className="text-base font-semibold text-gray-900 dark:text-gray-50">{title}</D.Title>
          {description ? (
            <D.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</D.Description>
          ) : (
            <D.Description className="sr-only">{title}</D.Description>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
