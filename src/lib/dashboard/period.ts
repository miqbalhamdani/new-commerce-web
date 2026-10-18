// The dashboard's periods and the change against the period before (P1-114,
// 04-api-spec.md §5.7, BR-066).

export const periodOptions = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const

export type PeriodDays = (typeof periodOptions)[number]["value"]

const wibDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * The last `days` WIB days, today included, as the API's dates: `from` the
 * first day, `to` tomorrow, because to is exclusive. Days are WIB whatever
 * the shop's own zone (BR-007).
 */
export function periodRange(
  days: number,
  now = new Date(),
): { from: string; to: string } {
  const [y, m, d] = wibDate.format(now).split("-").map(Number)
  const day = (offset: number) =>
    new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10)
  return { from: day(1 - days), to: day(1) }
}

/**
 * The change from previous to current as a whole percent, or null when there
 * was nothing before to compare with.
 */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
