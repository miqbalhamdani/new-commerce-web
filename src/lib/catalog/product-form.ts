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

/** A new product's form, before anything is typed. */
export function emptyDraft(): ProductDraft {
  return {
    title: "",
    slug: "",
    description: "",
    brand_id: "",
    category_ids: [],
    attributes: [],
  }
}

/**
 * The POST body for a new product: only what was filled in, so the API's
 * defaults apply to the rest (BR-009). No slug: the API derives it from the
 * title and it is editable afterwards (BR-042).
 */
export function createBodyOf(draft: ProductDraft): Record<string, unknown> {
  const body: Record<string, unknown> = { title: draft.title.trim() }
  if (draft.description !== "") body.description = draft.description
  if (draft.brand_id !== "") body.brand_id = draft.brand_id
  if (draft.category_ids.length) body.category_ids = draft.category_ids
  const attrs = attributesOf(draft)
  if (Object.keys(attrs).length) body.attributes = attrs
  return body
}

const attributesOf = (d: ProductDraft) =>
  Object.fromEntries(
    d.attributes
      .filter(([k]) => k.trim() !== "")
      .map(([k, v]) => [k.trim(), v]),
  )

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
  const attrs = attributesOf(draft)
  if (
    JSON.stringify(attrs) !==
    JSON.stringify(Object.fromEntries(original.attributes))
  )
    body.attributes = attrs
  return body
}
