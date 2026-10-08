// Money and time as the API sends them, for people to read.
//
// Money is a plain integer of minor units, always IDR, no currency field
// (BR-006, BR-029): 19900000 is Rp 199.000. Time arrives as +07:00 (BR-007)
// and is shown in the shop's own zone.

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

/** 19900000 -> "Rp 199.000". */
export function formatMoney(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "—"
  return idr.format(minor / 100).replace(/ /g, " ")
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

/** Minor units as the plain number a price input shows: 19900000 -> "199000". */
export function moneyInput(minor: number | null | undefined): string {
  return minor === null || minor === undefined ? "" : String(minor / 100)
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
