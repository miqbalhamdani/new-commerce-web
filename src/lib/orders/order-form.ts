// The order PATCH (P1-109, 04-api-spec.md §5.2): only shipping_address, note
// and shipping, and only while pending (BR-079). Same base/draft/patch shape
// as the product form, trimmed to three fields.

import type { Order } from "@/lib/api/types"
import { moneyInput, parseMoney } from "@/lib/format"

export interface OrderDraft {
  line1: string
  line2: string
  city: string
  province: string
  postal_code: string
  note: string
  shipping: string // as the money input shows it
}

export function draftOf(o: Order): OrderDraft {
  return {
    line1: o.shipping_address.line1 ?? "",
    line2: o.shipping_address.line2 ?? "",
    city: o.shipping_address.city ?? "",
    province: o.shipping_address.province ?? "",
    postal_code: o.shipping_address.postal_code ?? "",
    note: o.note ?? "",
    shipping: moneyInput(o.shipping),
  }
}

/** Only what changed; null clears the note (BR-009). */
export function patchOf(o: Order, d: OrderDraft): Record<string, unknown> {
  const base = draftOf(o)
  const patch: Record<string, unknown> = {}
  if (
    d.line1 !== base.line1 ||
    d.line2 !== base.line2 ||
    d.city !== base.city ||
    d.province !== base.province ||
    d.postal_code !== base.postal_code
  ) {
    patch.shipping_address = {
      line1: d.line1,
      line2: d.line2 || null,
      city: d.city,
      province: d.province,
      postal_code: d.postal_code,
    }
  }
  if (d.note !== base.note) patch.note = d.note || null
  const shipping = parseMoney(d.shipping === "" ? "0" : d.shipping)
  if (shipping !== null && shipping !== o.shipping) patch.shipping = shipping
  return patch
}
