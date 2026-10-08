import { describe, expect, it } from "vitest"

import {
  guessMapping,
  mappingForApi,
  mappingProblem,
  previewCSV,
  previewRows,
} from "./import"

describe("import preview (P1-074)", () => {
  it("parses only the first rows in the browser (BR-044)", async () => {
    const lines = [
      "Nama Produk;SKU;Harga",
      ...Array.from({ length: 500 }, (_, i) => `Kaos ${i};K-${i};199000`),
    ]
    const file = new File(["﻿" + lines.join("\n")], "big.csv", {
      type: "text/csv",
    })
    const { header, rows } = await previewCSV(file)
    expect(header).toEqual(["Nama Produk", "SKU", "Harga"])
    expect(rows).toHaveLength(previewRows)
  })
  it("guesses a mapping from Indonesian headers", () => {
    expect(
      guessMapping([
        "Nama Produk",
        "SKU",
        "Harga",
        "Harga Diskon",
        "Berat",
        "Warna",
        "Ukuran",
        "Catatan",
      ]),
    ).toEqual({
      "Nama Produk": "title",
      SKU: "sku",
      Harga: "regular_price",
      "Harga Diskon": "sale_price",
      Berat: "weight_grams",
      Warna: "option:Colour",
      Ukuran: "option:Size",
    })
  })
  it("needs title or sku, and no field twice", () => {
    expect(mappingProblem({ Harga: "regular_price" })).toMatch(/Title or SKU/)
    expect(mappingProblem({ A: "title", B: "title" })).toMatch(/twice/)
    expect(mappingProblem({ A: "title", B: "" })).toBeNull()
    expect(mappingForApi({ A: "title", B: "", C: "option:" })).toEqual({
      A: "title",
    })
  })
})
