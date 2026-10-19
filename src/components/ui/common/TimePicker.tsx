"use client"

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react"
import { useEffect, useState } from "react"

import { TimeIcon } from "@/icons"
import { cx } from "@/lib/utils"

import { fieldClasses } from "./Field"

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const pad = (n: number) => String(n).padStart(2, "0")
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))

/** The shop's clock now, WIB, rounded to the picker's 5 minutes. */
function nowWIB(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === "hour")?.value)
  const m =
    Math.round(Number(parts.find((p) => p.type === "minute")?.value) / 5) * 5
  return m === 60 ? `${pad((h + 1) % 24)}:00` : `${pad(h)}:${pad(m)}`
}

/**
 * A time field in the app's skin, the DatePicker's twin: "HH:MM" or "" in and
 * out. The popover has an hour column and a minute column in fives; picking a
 * minute closes it, as picking a day closes the calendar. Typing works too;
 * only a complete time (or a cleared box) reaches onChange.
 */
export function TimePicker({
  value,
  onChange,
  id,
  error,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  error?: boolean
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const [hh = "", mm = ""] = HHMM.test(value) ? value.split(":") : []

  const cell = (on: boolean) =>
    cx(
      "flex h-9 w-full shrink-0 items-center justify-center rounded-lg text-sm",
      on
        ? "bg-brand-500 font-medium text-white"
        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
    )
  // The chosen value scrolls into view when the panel opens.
  const reveal = (on: boolean) =>
    on
      ? (el: HTMLButtonElement | null) =>
          el?.scrollIntoView({ block: "center" })
      : undefined

  return (
    <Popover className={cx("relative", className)}>
      <input
        id={id}
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        placeholder="HH:MM"
        inputMode="numeric"
        disabled={disabled}
        className={cx(
          fieldClasses(error),
          "h-11 pr-11 disabled:cursor-not-allowed disabled:opacity-60",
        )}
        value={draft}
        onChange={(e) => {
          const v = e.target.value
          setDraft(v)
          if (v === "" || HHMM.test(v)) onChange(v)
        }}
        onBlur={() => setDraft(value)}
      />
      <PopoverButton
        aria-label="Open time picker"
        disabled={disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-400"
      >
        <TimeIcon aria-hidden className="size-5" />
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-999999 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-theme-lg [--anchor-gap:4px] focus:outline-none dark:border-gray-800 dark:bg-gray-dark"
      >
        {({ close }) => (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Hour", items: HOURS, on: hh },
                { label: "Minute", items: MINUTES, on: mm },
              ].map((col) => (
                <div key={col.label}>
                  <p className="py-1 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
                    {col.label}
                  </p>
                  <div
                    role="group"
                    aria-label={col.label}
                    className="custom-scrollbar flex h-56 flex-col gap-1 overflow-y-auto pr-1"
                  >
                    {col.items.map((v) => (
                      <button
                        key={v}
                        ref={reveal(v === col.on)}
                        type="button"
                        aria-label={`${col.label} ${v}`}
                        aria-pressed={v === col.on}
                        onClick={() => {
                          if (col.label === "Hour")
                            onChange(`${v}:${mm || "00"}`)
                          else {
                            onChange(`${hh || "00"}:${v}`)
                            close()
                          }
                        }}
                        className={cell(v === col.on)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  onChange("")
                  close()
                }}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(nowWIB())
                  close()
                }}
                className="rounded-lg px-2 py-1 text-sm font-medium text-brand-500 hover:text-brand-600"
              >
                Now
              </button>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  )
}
