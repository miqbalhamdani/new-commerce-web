"use client"

import { X } from "lucide-react"
import { useState } from "react"

import { fieldClasses } from "@/components/ui/common/Field"
import { cx } from "@/lib/utils"

/** The API's limit on a post's tags (04-api-spec.md §13.2). */
export const maxTags = 10

/**
 * Tags as chips (P1-607): Enter or a comma adds what is typed, × or Backspace
 * in an empty box removes. Trimmed, never twice, at most ten.
 */
export function TagInput({
  id,
  value,
  onChange,
  disabled,
  error,
  "aria-label": ariaLabel,
}: {
  id: string
  value: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
  error?: boolean
  "aria-label"?: string
}) {
  const [text, setText] = useState("")
  const full = value.length >= maxTags

  function add(raw: string) {
    const tags = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t))
    if (tags.length) onChange([...value, ...new Set(tags)].slice(0, maxTags))
    setText("")
  }

  return (
    <div
      className={cx(
        fieldClasses(error),
        "flex min-h-11 flex-wrap items-center gap-1.5 !py-1.5",
        disabled && "opacity-60",
      )}
    >
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
        >
          {t}
          {!disabled && (
            <button
              type="button"
              aria-label={`Remove ${t}`}
              className="text-brand-400 hover:text-brand-700"
              onClick={() => onChange(value.filter((x) => x !== t))}
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && !full && (
        <input
          id={id}
          aria-label={ariaLabel}
          value={text}
          placeholder={value.length ? "" : "Type a tag, then Enter"}
          className="min-w-24 flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0"
          onChange={(e) => {
            if (e.target.value.includes(",")) add(e.target.value)
            else setText(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add(text)
            } else if (e.key === "Backspace" && text === "" && value.length)
              onChange(value.slice(0, -1))
          }}
          onBlur={() => text.trim() && add(text)}
        />
      )}
    </div>
  )
}
