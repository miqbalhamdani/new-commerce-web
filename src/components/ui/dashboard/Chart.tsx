"use client"

import type { ApexOptions } from "apexcharts"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"

/**
 * ApexCharts (react-apexcharts), the library TailAdmin's dashboards use.
 * It touches `window` on import, so it only ever renders in the browser.
 */
export const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
})

/**
 * The chart colours for the current theme. The two categorical slots passed
 * the dataviz checks (lightness band, chroma, CVD and contrast) on each mode's
 * card: brand-500 then orange-500 in light, brand-500 then orange-600 in dark,
 * where orange-500 is too light. Ink and grid are the gray tokens text and
 * dividers already use, so a chart reads as part of its card.
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return {
    dark,
    series: ["#465FFF", dark ? "#EC4A0A" : "#FB6514"],
    ink: dark ? "#a8a8a8" : "#667085",
    grid: dark ? "#333333" : "#E4E7EC",
  }
}

/** What every dashboard chart shares: no toolbar, no zoom, the app's font. */
export function baseOptions(t: ReturnType<typeof useChartTheme>): ApexOptions {
  return {
    chart: {
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
      animations: { enabled: false },
    },
    theme: { mode: t.dark ? "dark" : "light" },
    colors: t.series,
    dataLabels: { enabled: false },
    grid: { borderColor: t.grid, strokeDashArray: 0 },
    tooltip: { theme: t.dark ? "dark" : "light" },
    legend: { show: false },
  }
}
