// Numbered paging for the product, order and customer lists (P1-232): the
// API takes `page` and answers `total` (04-api-spec.md §1, P1-231). The page
// lives in the URL next to the filters, so reload and the back button keep it.

/** The current page from the query: a positive integer, else 1. */
export function pageFromQuery(params: URLSearchParams): number {
  const n = Number(params.get("page"))
  return Number.isInteger(n) && n > 0 ? n : 1
}

/** The query with `page` set, or dropped on page 1 so a first page has a clean URL. */
export function withPage(params: URLSearchParams, page: number): string {
  const q = new URLSearchParams(params)
  if (page > 1) q.set("page", String(page))
  else q.delete("page")
  return q.toString()
}

/** "51–100 of 128" pieces: the rows shown and how many pages there are. */
export function pageSpan(page: number, limit: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : Math.min((page - 1) * limit + 1, total)
  const to = Math.min(page * limit, total)
  return { from, to, pages }
}

/**
 * The page buttons to show: the first, the last, and two either side of the
 * current one, with a gap ("…") where pages are skipped.
 */
export function pageWindow(page: number, pages: number): (number | "…")[] {
  const out: (number | "…")[] = []
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2) out.push(n)
    else if (out[out.length - 1] !== "…") out.push("…")
  }
  return out
}
