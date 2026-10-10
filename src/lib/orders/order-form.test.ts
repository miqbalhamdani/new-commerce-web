import { describe, expect, it } from "vitest"

import type { Order } from "@/lib/api/types"
import { draftOf, patchOf } from "@/lib/orders/order-form"

const order = {
  id: "o1",
  shipping_address: {
    line1: "Jl. Melati 12",
    line2: null,
    city: "Bandung",
    province: "Jawa Barat",
    postal_code: "40115",
  },
  note: "Bungkus kado",
  shipping: 1500000,
} as unknown as Order

describe("the order PATCH body (P1-109)", () => {
  it("sends only what changed", () => {
    const d = draftOf(order)
    expect(patchOf(order, d)).toEqual({})

    expect(patchOf(order, { ...d, note: "Baru" })).toEqual({ note: "Baru" })
    expect(patchOf(order, { ...d, note: "" })).toEqual({ note: null })
    expect(patchOf(order, { ...d, shipping: "20,000" })).toEqual({
      shipping: 2000000,
    })
  })

  it("sends the whole address when any part of it moves", () => {
    const d = { ...draftOf(order), city: "Jakarta" }
    expect(patchOf(order, d)).toEqual({
      shipping_address: {
        line1: "Jl. Melati 12",
        line2: null,
        city: "Jakarta",
        province: "Jawa Barat",
        postal_code: "40115",
      },
    })
  })

  it("an emptied shipping input means zero", () => {
    const d = { ...draftOf(order), shipping: "" }
    expect(patchOf(order, d)).toEqual({ shipping: 0 })
  })
})
