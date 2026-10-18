"use client"

import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import Link from "next/link"

import { cx } from "@/lib/utils"

import { ApexChart, baseOptions, useChartTheme } from "./Chart"

/**
 * One number in a card, TailAdmin's metric tile: label, value, and either a
 * link to the list behind it (needs action) or the change against the period
 * before with a sparkline of the period (P1-114).
 */
export function StatTile({
  label,
  value,
  sub,
  icon,
  href,
  delta,
  periodLabel,
  trend,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  /** The whole tile opens this list. */
  href?: string
  /** Whole percent against the period before; null when there was nothing to compare with. */
  delta?: number | null
  /** "30 days", for the delta's "vs previous 30 days". */
  periodLabel?: string
  /** One value per day, with its date and how to read it, for the sparkline. */
  trend?: { dates: string[]; values: number[]; format: (v: number) => string }
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {label}
        </p>
        {icon && (
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-white/90"
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-title-sm font-bold text-gray-800 dark:text-white/90">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {sub}
            </p>
          )}
          {delta !== undefined && (
            <Delta delta={delta} periodLabel={periodLabel} />
          )}
        </div>
        {trend && <Sparkline {...trend} label={label} />}
      </div>
    </>
  )
  const frame =
    "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          frame,
          "block transition-colors hover:border-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:border-brand-800",
        )}
      >
        {body}
      </Link>
    )
  }
  return <div className={frame}>{body}</div>
}

/** Up is good and down is not, so the badge carries an arrow and words, never colour alone. */
function Delta({
  delta,
  periodLabel,
}: {
  delta: number | null
  periodLabel?: string
}) {
  if (delta === null) {
    return (
      <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
        {periodLabel
          ? `Nothing in the previous ${periodLabel} to compare with`
          : "Nothing to compare with"}
      </p>
    )
  }
  const up = delta >= 0
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
      <span
        className={cx(
          "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium",
          up
            ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
            : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
        )}
      >
        {up ? (
          <ArrowUpRight aria-hidden className="size-3.5" />
        ) : (
          <ArrowDownRight aria-hidden className="size-3.5" />
        )}
        {up ? "+" : ""}
        {delta}%
      </span>
      {periodLabel && `vs previous ${periodLabel}`}
    </p>
  )
}

function Sparkline({
  dates,
  values,
  format,
  label,
}: {
  dates: string[]
  values: number[]
  format: (v: number) => string
  label: string
}) {
  const t = useChartTheme()
  const base = baseOptions(t)
  return (
    <div className="w-28 shrink-0" role="img" aria-label={`${label} per day`}>
      <ApexChart
        type="area"
        height={48}
        width="100%"
        series={[{ name: label, data: values }]}
        options={{
          ...base,
          chart: { ...base.chart, sparkline: { enabled: true } },
          colors: [t.series[0]],
          stroke: { curve: "monotoneCubic", width: 2 },
          fill: {
            type: "gradient",
            gradient: { opacityFrom: 0.35, opacityTo: 0, stops: [0, 100] },
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
