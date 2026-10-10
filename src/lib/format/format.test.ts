import { describe, expect, it } from "vitest"

import {
  formatDateTime,
  formatMoney,
  groupDigits,
  moneyInput,
  parseMoney,
} from "./index"

describe("money", () => {
  it("formats minor units as rupiah", () => {
    expect(formatMoney(19900000)).toBe("Rp\u00a0199,000")
    expect(formatMoney(129900000)).toBe("Rp\u00a01,299,000")
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
    expect(moneyInput(19900000)).toBe("199,000")
    expect(parseMoney(moneyInput(19900000))).toBe(19900000)
    expect(parseMoney("1,299,000")).toBe(129900000)
  })
  it("groups digits as they are typed", () => {
    expect(groupDigits("1500000")).toBe("1,500,000")
    expect(groupDigits("Rp 15.000x")).toBe("15,000")
    expect(groupDigits("007")).toBe("7")
    expect(groupDigits("")).toBe("")
  })
})

describe("time", () => {
  it("shows the instant in the shop's zone", () => {
    expect(formatDateTime("2026-10-06T16:15:00+07:00", "Asia/Jakarta")).toContain("16:15")
    expect(formatDateTime("2026-10-06T16:15:00+07:00", "Asia/Makassar")).toContain("17:15")
  })
})
