"use client"

import { cx } from "@/lib/utils"

import { ApexChart, baseOptions, useChartTheme } from "./Chart"

/** The legend's dots, in the donut's order (useChartTheme().share). */
const dots = ["bg-brand-500", "bg-brand-300"]

/**
 * A whole split by part, as TailAdmin's "Sales Category" donut (P1-114): the
 * total in the middle, each part named beside it with its share. The share
 * and its figures are written out, so no one needs the shades to read it.
 */
export function ShareDonut({
  label,
  parts,
  total,
  empty,
}: {
  /** Names the chart for screen readers: "Sales by channel". */
  label: string
  /** value is what the shares are of; detail is said beside the share. */
  parts: { name: string; value: number; detail: string; tooltip: string }[]
  /** The middle: the whole, and one line under it. */
  total: { value: string; sub: string }
  /** Said in place of the chart when every part is zero. */
  empty: string
}) {
  const t = useChartTheme()
  const sum = parts.reduce((s, p) => s + p.value, 0)
  if (sum === 0) {
    return (
      <p className="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
        {empty}
      </p>
    )
  }
  const share = (v: number) => Math.round((v / sum) * 100)
  const base = baseOptions(t)
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.name} ${share(p.value)}%`).join(", ")}`}
        className="relative size-48 shrink-0"
      >
        <ApexChart
          type="donut"
          width={192}
          height={192}
          series={parts.map((p) => p.value)}
          options={{
            ...base,
            labels: parts.map((p) => p.name),
            colors: t.share,
            stroke: { width: 2, colors: [t.surface] },
            plotOptions: {
              pie: {
                expandOnClick: false,
                donut: { size: "66%", labels: { show: false } },
              },
            },
            states: {
              hover: { filter: { type: "none" } },
              active: { filter: { type: "none" } },
            },
            tooltip: {
              ...base.tooltip,
              y: {
                formatter: (_v, o) => parts[o?.seriesIndex ?? 0]?.tooltip ?? "",
              },
            },
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Total
          </p>
          <p className="text-lg font-bold text-gray-800 dark:text-white/90">
            {total.value}
          </p>
          <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            {total.sub}
          </p>
        </div>
      </div>
      <ul className="min-w-0 space-y-5">
        {parts.map((p, i) => (
          <li key={p.name}>
            <p className="flex items-center gap-2 text-theme-sm font-medium text-gray-800 dark:text-white/90">
              <span
                aria-hidden
                className={cx("size-2.5 shrink-0 rounded-full", dots[i])}
              />
              {p.name}
            </p>
            <p className="mt-1 pl-[18px] text-theme-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-800 dark:text-white/90">
                {share(p.value)}%
              </span>
              {" • "}
              {p.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
