import { describe, expect, it } from "vitest"

import {
  departureOf,
  move,
  packageBodyOf,
  packageDraftOf,
  seatsOf,
} from "./package"
import { draftOf, patchOf } from "./product-form"

describe("package details (BR-171)", () => {
  it("sends empty text as null and drops empty rows", () => {
    const d = packageDraftOf(null)
    d.departure_text = " Desember 2026 "
    d.seats_left = "12"
    d.hotels = [
      { city: "Makkah", name: "Hilton", stars: "4", nights: "", variant: "" },
      { city: "", name: "", stars: "", nights: "", variant: "" },
    ]
    d.itinerary = [
      { title: "Jakarta – Madinah", text: "" },
      { title: "", text: "" },
    ]
    d.includes = ["Visa", " "]
    expect(packageBodyOf(d)).toMatchObject({
      departure_text: "Desember 2026",
      departure_date: null,
      seats_left: 12,
      seats_total: null,
      hotels: [
        {
          city: "Makkah",
          name: "Hilton",
          stars: 4,
          nights: null,
          variant: null,
        },
      ],
      itinerary: [{ title: "Jakarta – Madinah", text: null }],
      includes: ["Visa"],
    })
  })

  it("moves a day up and down, and not past either end", () => {
    expect(move(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"])
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"])
  })

  it("patches the package whole, only when it changed", () => {
    const product = {
      title: "Umrah",
      slug: "umrah",
      description: null,
      brand: null,
      categories: [],
      attributes: {},
      package: { ...packageBodyOf(packageDraftOf(null)), seats_left: 3 },
    } as unknown as Parameters<typeof draftOf>[0]
    const original = draftOf(product, true)
    expect(patchOf(original, { ...original })).toEqual({})
    const changed = {
      ...original,
      package: { ...original.package!, seats_left: "2" },
    }
    expect(patchOf(original, changed).package).toMatchObject({ seats_left: 2 })
    // A retail shop's form has no package and never sends one.
    expect(draftOf(product).package).toBeNull()
  })

  it("shows departure and seats in a list", () => {
    const brief = {
      departure_date: "2026-12-14",
      departure_text: null,
      seats_left: 0,
      seats_total: 45,
    }
    expect(departureOf(brief)).toBe("14 Dec 2026")
    expect(seatsOf(brief)).toBe("Full")
    expect(seatsOf({ ...brief, seats_left: 12 })).toBe("12 / 45")
    expect(
      departureOf({
        ...brief,
        departure_date: null,
        departure_text: "Juni 2027",
      }),
    ).toBe("Juni 2027")
    expect(seatsOf(null)).toBe("—")
  })
})
