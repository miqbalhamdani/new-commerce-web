import Papa from "papaparse"

/** How many rows the browser looks at: a preview for mapping, not the import (BR-044). */
export const previewRows = 50

export const importFields = [
  { value: "", label: "Ignore" },
  { value: "title", label: "Title" },
  { value: "sku", label: "SKU" },
  { value: "regular_price", label: "Regular price (Rp)" },
  { value: "sale_price", label: "Sale price (Rp)" },
  { value: "weight_grams", label: "Weight (g)" },
  { value: "barcode", label: "Barcode" },
  { value: "option", label: "Option…" },
] as const

/** Reads the header and the first rows only. The server parses the whole file. */
export function previewCSV(
  file: File,
): Promise<{ header: string[]; rows: string[][] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      preview: previewRows + 1,
      skipEmptyLines: "greedy",
      complete: (r) => {
        const [header = [], ...rows] = r.data
        resolve({ header: header.map((h) => h.replace(/^﻿/, "").trim()), rows })
      },
      error: reject,
    })
  })
}

const guesses: [RegExp, string][] = [
  [/^(nama( produk)?|title|product( name)?|judul)$/i, "title"],
  [/^(sku|kode( produk)?)$/i, "sku"],
  [/^(harga( normal)?|price|regular price)$/i, "regular_price"],
  [/^(harga (diskon|promo|coret)|sale( price)?)$/i, "sale_price"],
  [/^(berat|weight)( \(g(ram)?\))?$/i, "weight_grams"],
  [/^(barcode|ean|gtin)$/i, "barcode"],
  [/^(warna|colou?r)$/i, "option:Colour"],
  [/^(ukuran|size)$/i, "option:Size"],
]

/** A first mapping from the tenant's own headers, Indonesian or English. */
export function guessMapping(header: string[]): Record<string, string> {
  const used = new Set<string>()
  const mapping: Record<string, string> = {}
  for (const h of header) {
    const hit = guesses.find(
      ([re, target]) => re.test(h.trim()) && !used.has(target),
    )
    if (hit) {
      mapping[h] = hit[1]
      used.add(hit[1])
    }
  }
  return mapping
}

/** The mapping as the API takes it: ignored columns dropped. */
export function mappingForApi(
  mapping: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(mapping).filter(([, t]) => t !== "" && t !== "option:"),
  )
}

export function mappingProblem(mapping: Record<string, string>): string | null {
  const targets = Object.values(mappingForApi(mapping))
  if (!targets.includes("title") && !targets.includes("sku"))
    return "Map a column to Title or SKU."
  const dup = targets.find((t, i) => targets.indexOf(t) !== i)
  return dup ? `${dup.replace("option:", "Option ")} is mapped twice.` : null
}
