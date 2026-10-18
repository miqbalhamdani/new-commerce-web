"use client"

import type { DashboardDay } from "@/lib/api/types"
import { formatMoney, formatMoneyCompact } from "@/lib/format"

import { ApexChart, baseOptions, useChartTheme } from "./Chart"

const shortDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

/** "2026-09-18" -> "18 Sep". The date is already a WIB day, so it is read as-is. */
export function dayLabel(date: string) {
  return shortDay.format(new Date(date + "T00:00:00Z"))
}

/**
 * Sales per WIB day as one area series (P1-114). Orders are a different scale,
 * so they ride in the tooltip and the table rather than on a second axis. The
 * table holds every value the chart does, for anyone the chart does not serve.
 */
export function SalesChart({ days }: { days: DashboardDay[] }) {
  const t = useChartTheme()
  const base = baseOptions(t)
  const labels = days.map((d) => dayLabel(d.date))
  return (
    <div>
      <div
        role="img"
        aria-label="Sales per day; the same figures are in the table below."
      >
        <ApexChart
          type="area"
          height={300}
          width="100%"
          series={[{ name: "Sales", data: days.map((d) => d.sales) }]}
          options={{
            ...base,
            colors: [t.series[0]],
            stroke: { curve: "monotoneCubic", width: 2 },
            fill: {
              type: "gradient",
              gradient: { opacityFrom: 0.3, opacityTo: 0, stops: [0, 100] },
            },
            markers: { size: 0, hover: { size: 5 } },
            xaxis: {
              categories: labels,
              tickAmount: Math.min(days.length, 8),
              labels: {
                style: { colors: t.ink },
                rotate: 0,
                hideOverlappingLabels: true,
              },
              axisBorder: { show: false },
              axisTicks: { show: false },
              tooltip: { enabled: false },
            },
            yaxis: {
              min: 0,
              forceNiceScale: true,
              labels: {
                style: { colors: [t.ink] },
                formatter: (v) => formatMoneyCompact(v),
              },
            },
            tooltip: {
              ...base.tooltip,
              y: {
                formatter: (v, opts) => {
                  const orders = days[opts?.dataPointIndex ?? -1]?.orders ?? 0
                  return `${formatMoney(v)} · ${orders} ${orders === 1 ? "order" : "orders"}`
                },
              },
            },
          }}
        />
      </div>
      <details className="mt-2 text-theme-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90">
          Show as a table
        </summary>
        <div className="mt-3 max-h-72 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="text-theme-xs text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-2 font-medium">Day</th>
                <th className="py-2 text-right font-medium">Orders</th>
                <th className="py-2 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums text-gray-700 dark:divide-gray-800 dark:text-gray-300">
              {days.map((d) => (
                <tr key={d.date}>
                  <td className="py-2">{dayLabel(d.date)}</td>
                  <td className="py-2 text-right">{d.orders}</td>
                  <td className="py-2 text-right">{formatMoney(d.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
