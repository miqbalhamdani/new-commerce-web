import { emptyRow, toRequest } from "./matrix"

export interface FirstProduct {
  title: string
  /** As typed, "199,000"; empty means no price yet. */
  price: string
  brandId: string
  categoryId: string
}

/**
 * Onboarding's first product (P1-068) as the requests it takes: the product
 * itself, then -- only when a price was typed -- its one variant through the
 * variant matrix, exactly as the product editor saves a product with no
 * options. Empty choices are left out rather than sent as null (BR-009).
 */
export function firstProductRequests(f: FirstProduct): {
  create: Record<string, unknown>
  matrix: ReturnType<typeof toRequest>["body"] | null
  error: string | null
} {
  const create: Record<string, unknown> = { title: f.title.trim() }
  if (f.brandId) create.brand_id = f.brandId
  if (f.categoryId) create.category_ids = [f.categoryId]
  if (!f.price.trim()) return { create, matrix: null, error: null }
  const { body, errors } = toRequest(
    [],
    [{ ...emptyRow, regular_price: f.price }],
  )
  return { create, matrix: body, error: errors.get(0) ?? null }
}
