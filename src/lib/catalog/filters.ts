// The product list's filters as URL query, so they survive reload and the
// back button (P1-033), and as the last set used, so leaving the list and
// coming back finds them where they were.

export interface ProductFilters {
  q: string
  status: "" | "draft" | "active" | "archived"
  brand_id: string
  category_id: string
  sort: "-created_at" | "-updated_at" | "title"
}

export const emptyFilters: ProductFilters = {
  q: "",
  status: "",
  brand_id: "",
  category_id: "",
  sort: "-created_at",
}

const keys = Object.keys(emptyFilters) as (keyof ProductFilters)[]

export function filtersFromQuery(params: URLSearchParams): ProductFilters {
  const f = { ...emptyFilters }
  for (const k of keys) {
    const v = params.get(k)
    if (v !== null) (f as Record<string, string>)[k] = v
  }
  if (!["", "draft", "active", "archived"].includes(f.status)) f.status = ""
  if (!["-created_at", "-updated_at", "title"].includes(f.sort))
    f.sort = "-created_at"
  return f
}

/** Only what differs from the defaults, so a clean list has a clean URL. */
export function filtersToQuery(f: ProductFilters): URLSearchParams {
  const p = new URLSearchParams()
  for (const k of keys) {
    if (f[k] !== emptyFilters[k]) p.set(k, f[k])
  }
  return p
}

const storageKey = "products.filters"

export function rememberFilters(query: string) {
  try {
    localStorage.setItem(storageKey, query)
  } catch {
    // A private window or blocked storage only loses the convenience.
  }
}

export function rememberedFilters(): string {
  try {
    return localStorage.getItem(storageKey) ?? ""
  } catch {
    return ""
  }
}
