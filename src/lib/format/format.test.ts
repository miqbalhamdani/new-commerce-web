import { describe, expect, it } from "vitest"

import { formatDateTime, formatMoney, moneyInput, parseMoney } from "./index"

describe("money", () => {
  it("formats minor units as rupiah", () => {
    expect(formatMoney(19900000)).toBe("Rp 199.000")
    expect(formatMoney(null)).toBe("—")
  })
  it("parses what people type, as minor units", () => {
    expect(parseMoney("199000")).toBe(19900000)
    expect(parseMoney("199.000")).toBe(19900000)
    expect(parseMoney("Rp 1.299.000")).toBe(129900000)
    expect(parseMoney("19,9")).toBe(19900)
    expect(parseMoney("abc")).toBeNull()
    expect(parseMoney("")).toBeNull()
  })
  it("round-trips through the input", () => {
    expect(parseMoney(moneyInput(19900000))).toBe(19900000)
  })
})

describe("time", () => {
  it("shows the instant in the shop's zone", () => {
    expect(formatDateTime("2026-10-06T16:15:00+07:00", "Asia/Jakarta")).toContain("16:15")
    expect(formatDateTime("2026-10-06T16:15:00+07:00", "Asia/Makassar")).toContain("17:15")
  })
})
