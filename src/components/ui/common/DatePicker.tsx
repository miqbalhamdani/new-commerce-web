"use client"

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react"
import { useEffect, useState } from "react"

import { CalenderIcon, ChevronLeftIcon } from "@/icons"
import { cx } from "@/lib/utils"

import { fieldClasses } from "./Field"

const ISO = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const pad = (n: number) => String(n).padStart(2, "0")
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/**
 * A date field in the app's skin; the native <input type="date"> popup can't
 * be themed. Same contract as the native one: "YYYY-MM-DD" or "" in and out.
 * Typing works too; only a complete date (or a cleared box) reaches onChange.
 */
export function DatePicker({
  value,
  onChange,
  id,
  error,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  error?: boolean
  className?: string
  "aria-label"?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const today = new Date()
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate())
  const shown = ISO.test(value) ? value : todayIso
  const [view, setView] = useState({
    y: Number(shown.slice(0, 4)),
    m: Number(shown.slice(5, 7)) - 1,
  })

  function step(by: number) {
    setView(({ y, m }) => {
      const d = new Date(y, m + by, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const lead = new Date(view.y, view.m, 1).getDay()
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const cells = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]

  return (
    <Popover className={cx("relative", className)}>
      <input
        id={id}
        aria-label={ariaLabel}
        aria-invalid={error || undefined}
        placeholder="YYYY-MM-DD"
        inputMode="numeric"
        className={cx(fieldClasses(error), "h-11 pr-11")}
        value={draft}
        onChange={(e) => {
          const v = e.target.value
          setDraft(v)
          if (v === "" || ISO.test(v)) onChange(v)
        }}
        onBlur={() => setDraft(value)}
      />
      <PopoverButton
        aria-label="Open calendar"
        onClick={() =>
          setView({
            y: Number(shown.slice(0, 4)),
            m: Number(shown.slice(5, 7)) - 1,
          })
        }
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-brand-500 focus:outline-none dark:text-gray-400"
      >
        <CalenderIcon aria-hidden className="size-5" />
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-999999 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-theme-lg [--anchor-gap:4px] focus:outline-none dark:border-gray-800 dark:bg-gray-dark"
      >
        {({ close }) => (
          <>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => step(-1)}
                className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              >
                <ChevronLeftIcon aria-hidden className="size-4" />
              </button>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                {new Intl.DateTimeFormat("en-GB", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(view.y, view.m, 1))}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => step(1)}
                className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              >
                <ChevronLeftIcon aria-hidden className="size-4 rotate-180" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((d) => (
                <span
                  key={d}
                  className="py-1 text-xs font-medium text-gray-400 dark:text-gray-500"
                >
                  {d}
                </span>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <span key={`blank-${i}`} />
                const date = iso(view.y, view.m, d)
                return (
                  <button
                    key={date}
                    type="button"
                    aria-label={date}
                    aria-pressed={date === value}
                    onClick={() => {
                      onChange(date)
                      close()
                    }}
                    className={cx(
                      "flex h-9 items-center justify-center rounded-lg text-sm",
                      date === value
                        ? "bg-brand-500 font-medium text-white"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
                      date === todayIso &&
                        date !== value &&
                        "font-semibold text-brand-500 dark:text-brand-400",
                    )}
                  >
                    {d}
                  </button>
                )
              })}
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
                  onChange(todayIso)
                  close()
                }}
                className="rounded-lg px-2 py-1 text-sm font-medium text-brand-500 hover:text-brand-600"
              >
                Today
              </button>
            </div>
          </>
        )}
      </PopoverPanel>
    </Popover>
  )
}
