// Manual order entry (P1-110, 04-api-spec.md §5.4). Prices never leave the
// client: lines carry variant_id, qty and discount, and the server prices
// them through variant_price() (BR-046, BR-078). unit_price here is display
// only, from the picked variant.

import type { ApiError } from "@/lib/api/client"
import { fieldError } from "@/lib/api/use-api"
import { parseMoney } from "@/lib/format"

export interface DraftLine {
  variant_id: string
  title: string // display only
  sku: string // display only
  unit_price: number // display only
  qty: number
  discount: string // as the money input shows it
}

export interface NewOrderDraft {
  name: string
  email: string
  phone: string
  line1: string
  line2: string
  city: string
  province: string
  postal_code: string
  lines: DraftLine[]
  shipping: string
  note: string
}

export const emptyDraft: NewOrderDraft = {
  name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  province: "",
  postal_code: "",
  lines: [],
  shipping: "",
  note: "",
}

/** What POST /v1/orders accepts -- display-only fields stripped. */
export function createBody(d: NewOrderDraft): Record<string, unknown> {
  return {
    source: "manual",
    customer: {
      name: d.name.trim(),
      email: d.email.trim() || null,
      phone: d.phone.trim() || null,
    },
    shipping_address: {
      line1: d.line1.trim(),
      line2: d.line2.trim() || null,
      city: d.city.trim(),
      province: d.province.trim(),
      postal_code: d.postal_code.trim(),
    },
    lines: d.lines.map((l) => ({
      variant_id: l.variant_id,
      qty: l.qty,
      ...(parseMoney(l.discount) ? { discount: parseMoney(l.discount) } : {}),
    })),
    ...(parseMoney(d.shipping) ? { shipping: parseMoney(d.shipping) } : {}),
    ...(d.note.trim() ? { note: d.note.trim() } : {}),
  }
}

/** The preview the form shows; the server recomputes all of it (BR-078). */
export function totals(d: NewOrderDraft) {
  const subtotal = d.lines.reduce((sum, l) => sum + l.unit_price * l.qty, 0)
  const discount = d.lines.reduce((sum, l) => sum + (parseMoney(l.discount) ?? 0), 0)
  const shipping = parseMoney(d.shipping) ?? 0
  return { subtotal, discount, shipping, total: subtotal + shipping - discount }
}

/** The API names a line's field as lines.<i>.<field> (P1-105). */
export function lineError(error: ApiError | null, i: number, field: string) {
  return fieldError(error, `lines.${i}.${field}`)
}

export function canSubmit(d: NewOrderDraft): boolean {
  return Boolean(
    d.name.trim() &&
      d.line1.trim() &&
      d.city.trim() &&
      d.province.trim() &&
      d.postal_code.trim() &&
      d.lines.length > 0 &&
      d.lines.every((l) => l.qty >= 1),
  )
}
