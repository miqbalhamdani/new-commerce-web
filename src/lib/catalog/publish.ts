import type { ApiError } from "@/lib/api/client"

export interface Failure {
  field: string
  detail: string
  variantId?: string
  /** Where the link goes: an element id on the editor page. */
  anchor: string
}

const cellColumn: Record<string, string> = {
  sku: "sku",
  price: "regular_price",
  weight: "weight_grams",
}

/**
 * publish_check_failed as links (BR-038): a variant failure points at its
 * matrix cell, the others at the editor section that fixes them.
 */
export function failuresOf(error: ApiError | null): Failure[] {
  if (error?.code !== "publish_check_failed") return []
  return (error.problem.errors ?? []).map((e) => {
    const variantId = (e as { variant_id?: string }).variant_id
    const detail = e.detail ?? e.field
    if (variantId && cellColumn[e.field]) {
      return {
        field: e.field,
        detail,
        variantId,
        anchor: `cell-${variantId}-${cellColumn[e.field]}`,
      }
    }
    const anchor =
      { media: "images", categories: "categories", variants: "variants" }[
        e.field
      ] ?? "details"
    return { field: e.field, detail, anchor }
  })
}
