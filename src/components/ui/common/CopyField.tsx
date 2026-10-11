"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import { fieldClasses } from "@/components/ui/common/Field"

/**
 * A read-only value with a Copy button: a secret shown once (an API key), or a
 * URL to paste elsewhere. Selecting the field on focus keeps manual copy a
 * single keystroke when the clipboard API is unavailable.
 */
export function CopyField({
  id,
  value,
  label,
}: {
  id: string
  value: string
  /** Names the value for assistive tech: "API key". */
  label: string
}) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Insecure context or denied permission: the field stays selectable.
      setCopied(false)
    }
  }
  return (
    <div className="flex gap-2">
      <input
        id={id}
        aria-label={label}
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={`${fieldClasses()} font-mono text-xs`}
      />
      <Button size="sm" variant="outline" type="button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}
