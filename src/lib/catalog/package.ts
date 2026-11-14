import type { components } from "@/lib/api/schema"

// An umrah shop's package details (BR-171) as the editor holds them: every
// field as typed text, so an empty box is "unset" and nothing is lost while
// someone types. The PATCH replaces the package whole.

export type Package = components["schemas"]["Package"]

export interface HotelDraft {
  city: string
  name: string
  stars: string
  nights: string
  /** The option value whose choice uses this hotel; "" for every choice. */
  variant: string
}

export interface DayDraft {
  title: string
  text: string
}

export interface PackageDraft {
  departure_date: string
  departure_text: string
  return_date: string
  duration_days: string
  airline: string
  route: string
  hotels: HotelDraft[]
  seats_left: string
  seats_total: string
  itinerary: DayDraft[]
  includes: string[]
  excludes: string[]
  bonus: string[]
  price_note: string
  cancellation_policy: string
}

const text = (v: string | null | undefined) => v ?? ""
const num = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v)

export function packageDraftOf(p: Package | null | undefined): PackageDraft {
  return {
    departure_date: text(p?.departure_date),
    departure_text: text(p?.departure_text),
    return_date: text(p?.return_date),
    duration_days: num(p?.duration_days),
    airline: text(p?.airline),
    route: text(p?.route),
    hotels: (p?.hotels ?? []).map((h) => ({
      city: h.city,
      name: h.name,
      stars: num(h.stars),
      nights: num(h.nights),
      variant: text(h.variant),
    })),
    seats_left: num(p?.seats_left),
    seats_total: num(p?.seats_total),
    itinerary: (p?.itinerary ?? []).map((d) => ({
      title: d.title,
      text: text(d.text),
    })),
    includes: [...(p?.includes ?? [])],
    excludes: [...(p?.excludes ?? [])],
    bonus: [...(p?.bonus ?? [])],
    price_note: text(p?.price_note),
    cancellation_policy: text(p?.cancellation_policy),
  }
}

const orNull = (v: string) => (v.trim() === "" ? null : v.trim())
const intOrNull = (v: string) => {
  const t = v.trim()
  return t === "" ? null : Number(t)
}
const lines = (l: string[]) => l.map((x) => x.trim()).filter((x) => x !== "")

/**
 * The package as the API takes it: unset text is null, whole numbers are
 * numbers, and empty list entries, hotels and days are left out. A number
 * that is not one is sent as typed, and the API names the field (422).
 */
export function packageBodyOf(d: PackageDraft): Package {
  return {
    departure_date: orNull(d.departure_date),
    departure_text: orNull(d.departure_text),
    return_date: orNull(d.return_date),
    duration_days: intOrNull(d.duration_days),
    airline: orNull(d.airline),
    route: orNull(d.route),
    hotels: d.hotels
      .filter((h) => h.city.trim() || h.name.trim())
      .map((h) => ({
        city: h.city.trim(),
        name: h.name.trim(),
        stars: intOrNull(h.stars),
        nights: intOrNull(h.nights),
        variant: orNull(h.variant),
      })),
    seats_left: intOrNull(d.seats_left),
    seats_total: intOrNull(d.seats_total),
    itinerary: d.itinerary
      .filter((x) => x.title.trim() || x.text.trim())
      .map((x) => ({ title: x.title.trim(), text: orNull(x.text) })),
    includes: lines(d.includes),
    excludes: lines(d.excludes),
    bonus: lines(d.bonus),
    price_note: orNull(d.price_note),
    cancellation_policy: orNull(d.cancellation_policy),
  }
}

/** Moves item i of a list one place up (-1) or down (+1). */
export function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by
  if (j < 0 || j >= list.length) return list
  const out = [...list]
  const tmp = out[i]
  out[i] = out[j]
  out[j] = tmp
  return out
}

const day = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

type Brief = {
  departure_date: string | null
  departure_text: string | null
  seats_left: number | null
  seats_total: number | null
} | null

/** A package's departure for a list: "14 Dec 2026", the month text, or "—". */
export function departureOf(p: Brief | undefined): string {
  if (p?.departure_date) return day.format(new Date(p.departure_date))
  return p?.departure_text ?? "—"
}

/** A package's seats for a list: "12 / 45", "Full", "12" or "—". */
export function seatsOf(p: Brief | undefined): string {
  if (p?.seats_left === null || p?.seats_left === undefined) return "—"
  if (p.seats_left === 0) return "Full"
  return p.seats_total === null
    ? String(p.seats_left)
    : `${p.seats_left} / ${p.seats_total}`
}
