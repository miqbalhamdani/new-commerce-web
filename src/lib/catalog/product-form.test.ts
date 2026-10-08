import { describe, expect, it } from "vitest"

import { patchOf, type ProductDraft } from "./product-form"

const base: ProductDraft = {
  title: "Tee",
  slug: "tee",
  description: "Kaos",
  brand_id: "b1",
  category_ids: ["c1", "c2"],
  attributes: [["material", "Cotton"]],
}

describe("patchOf", () => {
  it("sends nothing when nothing changed", () => {
    expect(patchOf(base, { ...base, category_ids: ["c2", "c1"] })).toEqual({})
  })
  it("sends only what changed, and null to clear (BR-009)", () => {
    expect(
      patchOf(base, {
        ...base,
        title: " Tee v2 ",
        description: "",
        brand_id: "",
      }),
    ).toEqual({
      title: "Tee v2",
      description: null,
      brand_id: null,
    })
  })
  it("sends categories and attributes whole", () => {
    expect(
      patchOf(base, {
        ...base,
        category_ids: ["c1"],
        attributes: [
          ["material", "Linen"],
          ["", "dropped"],
        ],
      }),
    ).toEqual({
      category_ids: ["c1"],
      attributes: { material: "Linen" },
    })
  })
})
