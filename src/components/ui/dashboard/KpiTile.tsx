"use client"

import { ArrowDown, ArrowUp } from "lucide-react"

import { cx } from "@/lib/utils"

import { ApexChart, baseOptions, useChartTheme } from "./Chart"

/**
 * Each figure's own colour, as TailAdmin's sales tiles have: the icon and the
 * sparkline, never the text. A tile holds one series, so the colour names the
 * figure rather than telling series apart; items sold is orange, not red,
 * because red would read as bad news.
 */
const tones = {
  green: { hex: "#12B76A", icon: "text-success-500" },
  purple: { hex: "#7A5AF8", icon: "text-theme-purple-500" },
  blue: { hex: "#0BA5EC", icon: "text-blue-light-500" },
  orange: { hex: "#FB6514", icon: "text-orange-500" },
} as const

/**
 * One of the period's figures, in TailAdmin's sales-tile shape (P1-114): the
 * name with its change against the period before under it, an icon, then the
 * value beside a sparkline of the period's days.
 */
export function KpiTile({
  label,
  value,
  delta,
  periodLabel,
  icon,
  tone,
  trend,
}: {
  label: string
  value: string
  /** Whole percent against the period before; null when there was nothing to compare with. */
  delta: number | null
  /** "30 days", for "vs previous 30 days". */
  periodLabel: string
  icon: React.ReactNode
  tone: keyof typeof tones
  /** The period's values with their dates, and how to read a value. */
  trend: {
    dates: string[]
    values: number[]
    format: (v: number) => string
  }
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            {label}
          </h3>
          <Delta delta={delta} periodLabel={periodLabel} />
        </div>
        <span aria-hidden className={cx("shrink-0", tones[tone].icon)}>
          {icon}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="shrink-0 whitespace-nowrap text-title-sm font-bold text-gray-800 dark:text-white/90">
          {value}
        </p>
        <Sparkline {...trend} label={label} color={tones[tone].hex} />
      </div>
    </div>
  )
}

/** Up is good and down is not, so the change carries an arrow and words, never colour alone. */
function Delta({
  delta,
  periodLabel,
}: {
  delta: number | null
  periodLabel: string
}) {
  if (delta === null) {
    return (
      <p className="mt-1.5 text-theme-sm text-gray-500 dark:text-gray-400">
        Nothing in the previous {periodLabel}
      </p>
    )
  }
  // Level is neither good nor bad: no arrow, no colour.
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "level"
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-theme-sm text-gray-500 dark:text-gray-400">
      <span
        className={cx(
          "inline-flex items-center gap-0.5 font-semibold",
          dir === "up" && "text-success-600 dark:text-success-500",
          dir === "down" && "text-error-600 dark:text-error-500",
          dir === "level" && "text-gray-700 dark:text-gray-300",
        )}
      >
        {dir === "up" && <ArrowUp aria-hidden className="size-4" />}
        {dir === "down" && <ArrowDown aria-hidden className="size-4" />}
        {dir !== "level" && (
          <span className="sr-only">{dir === "up" ? "Up " : "Down "}</span>
        )}
        {Math.abs(delta)}%
      </span>{" "}
      vs previous {periodLabel}
    </p>
  )
}

function Sparkline({
  dates,
  values,
  format,
  label,
  color,
}: {
  dates: string[]
  values: number[]
  format: (v: number) => string
  label: string
  color: string
}) {
  const t = useChartTheme()
  const base = baseOptions(t)
  return (
    <div
      className="min-w-0 max-w-48 flex-1"
      role="img"
      aria-label={`${label} per day`}
    >
      <ApexChart
        type="area"
        height={56}
        width="100%"
        series={[{ name: label, data: values }]}
        options={{
          ...base,
          chart: { ...base.chart, sparkline: { enabled: true } },
          colors: [color],
          stroke: { curve: "monotoneCubic", width: 1.5 },
          fill: {
            type: "gradient",
            gradient: { opacityFrom: 0.45, opacityTo: 0, stops: [0, 100] },
          },
          xaxis: { categories: dates },
          tooltip: {
            ...base.tooltip,
            x: { show: true },
            y: { formatter: format, title: { formatter: () => "" } },
            marker: { show: false },
          },
        }}
      />
    </div>
  )
}
