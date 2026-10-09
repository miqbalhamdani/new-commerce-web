import { describe, expect, it } from "vitest"

import { slugify } from "./slug"

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
