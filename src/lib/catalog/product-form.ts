import type { Product } from "@/lib/api/types"

/** What the editor holds while someone types. */
export interface ProductDraft {
  title: string
  slug: string
  description: string
  brand_id: string
  category_ids: string[]
  attributes: [string, string][]
}

export function draftOf(p: Product): ProductDraft {
  return {
    title: p.title,
    slug: p.slug,
    description: p.description ?? "",
    brand_id: p.brand?.id ?? "",
    category_ids: p.categories.map((c) => c.id),
    attributes: Object.entries(p.attributes ?? {}).map(([k, v]) => [
      k,
      String(v),
    ]),
  }
}

/**
 * The PATCH body: only what changed (BR-009). An emptied description or brand
 * is sent as null, which clears it; categories and attributes go whole.
 */
export function patchOf(
  original: ProductDraft,
  draft: ProductDraft,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (draft.title.trim() !== original.title) body.title = draft.title.trim()
  if (draft.slug !== original.slug) body.slug = draft.slug
  if (draft.description !== original.description)
    body.description = draft.description === "" ? null : draft.description
  if (draft.brand_id !== original.brand_id)
    body.brand_id = draft.brand_id === "" ? null : draft.brand_id
  if (
    [...draft.category_ids].sort().join() !==
    [...original.category_ids].sort().join()
  )
    body.category_ids = draft.category_ids
  const attrs = Object.fromEntries(
    draft.attributes
      .filter(([k]) => k.trim() !== "")
      .map(([k, v]) => [k.trim(), v]),
  )
  if (
    JSON.stringify(attrs) !==
    JSON.stringify(Object.fromEntries(original.attributes))
  )
    body.attributes = attrs
  return body
}
