import { describe, expect, it } from "vitest"

import {
  canQuote,
  canSubmit,
  createBody,
  emptyDraft,
  quoteBody,
  totals,
} from "@/lib/orders/new-order"

const line = {
  variant_id: "v1",
  title: "Basic Tee — Black / M",
  sku: "TEE-1",
  unit_price: 19900000,
  qty: 2,
  discount: "20,000",
}

describe("new-order helpers (P1-110)", () => {
  it("builds the body without any price field", () => {
    const d = {
      ...emptyDraft,
      name: "Dewi",
      line1: "Jl. Kenanga 4",
      city: "Surabaya",
      province: "Jawa Timur",
      postal_code: "60231",
      lines: [line],
      shipping: "15,000",
      note: "Via WhatsApp",
    }
    expect(createBody(d)).toEqual({
      source: "manual",
      customer: { name: "Dewi", email: null, phone: null },
      shipping_address: {
        line1: "Jl. Kenanga 4",
        line2: null,
        city: "Surabaya",
        province: "Jawa Timur",
        postal_code: "60231",
      },
      lines: [{ variant_id: "v1", qty: 2, discount: 2000000 }],
      shipping: 1500000,
      note: "Via WhatsApp",
    })
    expect(JSON.stringify(createBody(d))).not.toContain("unit_price")
  })

  it("previews the totals the way the server computes them", () => {
    const d = { ...emptyDraft, lines: [line], shipping: "15,000" }
    expect(totals(d)).toEqual({
      subtotal: 39800000,
      discount: 2000000,
      shipping: 1500000,
      total: 39300000,
    })
  })

  it("needs a name, an address and at least one line", () => {
    expect(canSubmit(emptyDraft)).toBe(false)
    expect(
      canSubmit({
        ...emptyDraft,
        name: "Dewi",
        line1: "Jl. A",
        city: "Surabaya",
        province: "Jawa Timur",
        postal_code: "60231",
        lines: [line],
      }),
    ).toBe(true)
  })

  it("sends a picked courier instead of an amount, and totals with its price (P1-218)", () => {
    const d = {
      ...emptyDraft,
      postal_code: "60231",
      lines: [line],
      shipping: "15,000",
      shipping_option: {
        courier_code: "jne",
        courier_service_code: "reg",
        courier_name: "JNE",
        service_name: "Reguler",
        price: 1100000,
        duration: "2 - 3 days",
      },
    }
    const body = createBody(d)
    expect(body.shipping_option).toEqual({
      courier_code: "jne",
      courier_service_code: "reg",
    })
    expect(body).not.toHaveProperty("shipping")
    expect(totals(d).shipping).toBe(1100000)
    expect(quoteBody(d)).toEqual({
      destination_postal_code: "60231",
      lines: [{ variant_id: "v1", qty: 2 }],
    })
    expect(canQuote(d)).toBe(true)
    expect(canQuote({ ...d, postal_code: "601" })).toBe(false)
    expect(canQuote({ ...d, lines: [] })).toBe(false)
  })
})
