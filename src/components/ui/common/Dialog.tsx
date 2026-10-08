"use client"

import { Modal } from "@/components/ui/modal"
import { useEffect, useId, useRef } from "react"

/**
 * A centred modal on the vendored TailAdmin Modal. The external API is
 * unchanged from the Radix days, so every dialog call site re-skins at once.
 *
 * The Modal has no focus trap (an accepted gap of the vendored set), so this
 * wrapper at least moves focus to the title when it opens; Escape and the
 * overlay close it.
 */
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
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      labelledBy={titleId}
      className="m-4 max-w-lg p-6 lg:p-8"
    >
      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        className="pr-10 text-lg font-semibold text-gray-800 outline-none dark:text-white/90"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      {children && <div className="mt-5">{children}</div>}
      {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
    </Modal>
  )
}
