import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api/client"

import { failuresOf } from "./publish"

describe("failuresOf (P1-075)", () => {
  it("links every publish-check failure to its field or matrix cell", () => {
    const error = new ApiError({
      type: "https://docs.example.com/errors/publish_check_failed",
      title: "Publish check failed",
      status: 422,
      trace_id: "t",
      errors: [
        {
          field: "sku",
          detail: "Variant Black / XL has no SKU",
          variant_id: "v1",
        },
        {
          field: "weight",
          detail: "Variant Black / XL: weight must be greater than zero",
          variant_id: "v1",
        },
        { field: "media", detail: "At least one image is required" },
        {
          field: "categories",
          detail: "At least one category of kind category is required",
        },
      ],
    })
    expect(failuresOf(error).map((f) => f.anchor)).toEqual([
      "cell-v1-sku",
      "cell-v1-weight_grams",
      "images",
      "categories",
    ])
  })
  it("is empty for any other error", () => {
    expect(failuresOf(null)).toEqual([])
  })
})
