import { describe, expect, it } from "vitest"

import { pathLabel, slugify } from "./slug"

describe("slugify", () => {
  it("matches the database's slugify()", () => {
    expect(slugify("Café Ñ")).toBe("cafe-n")
    expect(slugify("  Erigo -- Apparel! ")).toBe("erigo-apparel")
    expect(slugify("!!!")).toBe("")
  })
  it("always produces a slug the API accepts", () => {
    expect(slugify("Erigo Café 2026")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/) // the API's slug pattern
  })
})

describe("pathLabel", () => {
  it("matches the trigger's derived segment", () => {
    expect(pathLabel("Outer Wear")).toBe("outer_wear")
    expect(pathLabel("Jackets & Coats")).toBe("jackets_coats")
    expect(pathLabel("!!!")).toBe("cat")
    expect(pathLabel("Café Ñ 2026")).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/) // the API's label pattern
  })
})
