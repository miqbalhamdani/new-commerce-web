import { describe, expect, it } from "vitest"

import { firstProductRequests } from "./first-product"

describe("the onboarding first product (P1-068)", () => {
  it("sends only what was filled in, and no variant without a price", () => {
    expect(
      firstProductRequests({
        title: " Basic Tee ",
        price: "",
        brandId: "",
        categoryId: "",
      }),
    ).toEqual({ create: { title: "Basic Tee" }, matrix: null, error: null })
  })

  it("adds the brand, the category and one priced variant", () => {
    const r = firstProductRequests({
      title: "Basic Tee",
      price: "199,000",
      brandId: "b1",
      categoryId: "c1",
    })
    expect(r.create).toEqual({
      title: "Basic Tee",
      brand_id: "b1",
      category_ids: ["c1"],
    })
    expect(r.matrix).toEqual({
      option_names: [],
      rows: [
        {
          option_values: [],
          sku: null,
          regular_price: 19900000,
          sale_price: null,
        },
      ],
      archive_missing: true,
    })
    expect(r.error).toBeNull()
  })

  it("names a price that is not an amount", () => {
    expect(
      firstProductRequests({
        title: "Tee",
        price: "abc",
        brandId: "",
        categoryId: "",
      }).error,
    ).toBe("Regular price is not an amount")
  })
})
