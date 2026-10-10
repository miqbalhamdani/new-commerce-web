// Money and time as the API sends them, for people to read.
//
// Money is a plain integer of minor units, always IDR, no currency field
// (BR-006, BR-029): 19900000 is Rp 199,000. Time arrives as +07:00 (BR-007)
// and is shown in the shop's own zone.

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

/** 19900000 -> "Rp 199,000" (a no-break space keeps it on one line). */
export function formatMoney(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "—"
  return `Rp\u00a0${grouped.format(minor / 100)}`
}

/** Digits only, grouped in threes as someone types: "1500000" -> "1,500,000". */
export function groupDigits(text: string): string {
  const digits = text.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  return digits ? grouped.format(Number(digits)) : ""
}

/**
 * What a person types for a price -- "199000", "199.000", "Rp 199.000" -- as
 * minor units. Separators are thousands separators: rupiah has no cents in
 * practice. Null when it is not a whole amount.
 */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/rp|idr|[\s.,]/gi, "")
  if (!/^\d+$/.test(clean)) return null
  return Number(clean) * 100
}

/** Minor units as a price input shows them: 19900000 -> "199,000". */
export function moneyInput(minor: number | null | undefined): string {
  return minor === null || minor === undefined
    ? ""
    : grouped.format(minor / 100)
}

/** An instant in the shop's time zone: "6 Oct 2026, 16.15". */
export function formatDateTime(iso: string | null | undefined, timeZone = "Asia/Jakarta"): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso))
}

/** "3 hours ago" in the largest fitting unit; "just now" under a minute. */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—"
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  const s = (new Date(iso).getTime() - now) / 1000
  const abs = Math.abs(s)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ]
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf.format(Math.round(s / secs), unit)
  }
  return "just now"
}
