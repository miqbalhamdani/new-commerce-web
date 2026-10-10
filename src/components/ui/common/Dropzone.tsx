"use client"

import { useRef, useState } from "react"

import Button from "@/components/ui/button/Button"
import { cx } from "@/lib/utils"

/**
 * The dashed drop area: drag files in, or pick them with the button that
 * opens the hidden input. `children` is the prompt (icon, copy) above the
 * button.
 */
export function Dropzone({
  accept,
  multiple,
  onFiles,
  children,
  className,
}: {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  children: React.ReactNode
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        setOver(false)
        onFiles([...e.dataTransfer.files])
      }}
      className={cx(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed bg-gray-50 p-7 text-center text-theme-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400",
        over
          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/[0.08]"
          : "border-gray-300 dark:border-gray-700",
        className,
      )}
    >
      {children}
      <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
        {multiple ? "Choose files" : "Choose file"}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles([...e.target.files])
          e.target.value = "" // picking the same file again fires again
        }}
      />
    </div>
  )
}
