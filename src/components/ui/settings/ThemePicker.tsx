"use client"

import { Check } from "lucide-react"

import { websiteDomain } from "@/components/ui/settings/SettingsForm"
import type { ShopTheme } from "@/lib/api/types"
import { themeOf, themes } from "@/lib/themes"
import { cx } from "@/lib/utils"

/**
 * The website's theme (BR-143): each card shows what the theme was made for
 * and links to a demo shop drawn in it, but any shop may pick any of them.
 */
export function ThemePicker({
  value,
  disabled,
  onChange,
}: {
  value: ShopTheme
  disabled?: boolean
  onChange: (key: ShopTheme) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {themes.map((t) => {
        const on = t.key === value
        const suits = t.suits.charAt(0).toLowerCase() + t.suits.slice(1)
        return (
          <div
            key={t.key}
            className={cx(
              "relative flex flex-col overflow-hidden rounded-xl border bg-white focus-within:ring-2 focus-within:ring-brand-500/40 dark:bg-white/[0.03]",
              on
                ? "border-brand-500"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700",
            )}
          >
            <label
              className={cx("flex flex-col", !disabled && "cursor-pointer")}
            >
              <input
                type="radio"
                name="theme"
                value={t.key}
                checked={on}
                disabled={disabled}
                onChange={() => onChange(t.key)}
                aria-label={`${t.name}, suits ${suits}`}
                className="sr-only"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- a fixed screenshot of the theme's demo shop */}
              <img
                src={`/themes/${t.key}.webp`}
                alt=""
                width={640}
                height={400}
                className="aspect-[16/10] w-full bg-gray-100 object-cover object-top dark:bg-gray-800"
              />
              <span className="flex items-start justify-between gap-2 px-3 pt-3">
                <span>
                  <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                    {t.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    Suits {suits}
                  </span>
                </span>
                {on && (
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-brand-500"
                    aria-hidden
                  />
                )}
              </span>
            </label>
            <a
              href={`https://${t.demo}.${websiteDomain}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 pb-3 pt-1.5 text-xs font-medium text-brand-500 hover:text-brand-600"
            >
              View demo ↗
            </a>
          </div>
        )
      })}
    </div>
  )
}

/**
 * One of the theme's four colours (BR-143). An empty value is the theme's
 * first, which the website uses when the shop picked none.
 */
export function ColorPicker({
  theme,
  value,
  disabled,
  onChange,
}: {
  theme: ShopTheme
  value: string
  disabled?: boolean
  onChange: (color: string) => void
}) {
  const { colors } = themeOf(theme)
  const current = value || colors[0]
  return (
    <div role="radiogroup" aria-label="Colour" className="flex gap-3">
      {colors.map((c, i) => {
        const on = c === current
        return (
          <label
            key={c}
            title={c}
            className={cx(
              "relative rounded-full p-0.5 ring-offset-2 focus-within:ring-2 focus-within:ring-brand-500/40 dark:ring-offset-gray-900",
              on ? "ring-2 ring-gray-800 dark:ring-white/80" : "",
              !disabled && "cursor-pointer",
            )}
          >
            <input
              type="radio"
              name="brand-color"
              value={c}
              checked={on}
              disabled={disabled}
              onChange={() => onChange(i === 0 ? "" : c)}
              aria-label={`Colour ${i + 1}, ${c}${i === 0 ? " (the theme's default)" : ""}`}
              className="sr-only"
            />
            <span
              className="block size-9 rounded-full border border-black/10"
              style={{ background: c }}
            />
          </label>
        )
      })}
    </div>
  )
}
