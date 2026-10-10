// The order list's filters as URL query (P1-108, 04-api-spec.md §5.1).
// status repeats to OR values, so this one round-trips with getAll/append
// where the product filters use get/set.

import type { OrderStatus } from "@/lib/api/types"

export interface OrderFilters {
  q: string
  status: OrderStatus[]
  refund_owed: boolean
  sort: "-placed_at" | "placed_at"
}

export const emptyFilters: OrderFilters = {
  q: "",
  status: [],
  refund_owed: false,
  sort: "-placed_at",
}

export const statusValues: OrderStatus[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "completed",
  "cancelled",
]

export function filtersFromQuery(params: URLSearchParams): OrderFilters {
  return {
    q: params.get("q") ?? "",
    status: params
      .getAll("status")
      .filter((s): s is OrderStatus =>
        (statusValues as string[]).includes(s),
      ),
    refund_owed: params.get("refund_owed") === "true",
    sort: params.get("sort") === "placed_at" ? "placed_at" : "-placed_at",
  }
}

/** Only what differs from the defaults, so a clean list has a clean URL. */
export function filtersToQuery(f: OrderFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set("q", f.q)
  for (const s of f.status) p.append("status", s)
  if (f.refund_owed) p.set("refund_owed", "true")
  if (f.sort !== emptyFilters.sort) p.set("sort", f.sort)
  return p
}

const storageKey = "orders.filters"

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

/** The §5.1 saved views: plain filter sets over status and refund_owed. */
export const views = [
  { key: "confirm", label: "To confirm payment", status: ["pending"], refund_owed: false },
  { key: "ship", label: "To ship", status: ["paid", "processing"], refund_owed: false },
  { key: "shipped", label: "Shipped", status: ["shipped"], refund_owed: false },
  { key: "refund", label: "Cancelled, refund owed", status: [], refund_owed: true },
] as const satisfies readonly {
  key: string
  label: string
  status: readonly OrderStatus[]
  refund_owed: boolean
}[]

/** The view the current filters match; q and sort stay orthogonal. */
export function activeView(f: OrderFilters): string | null {
  for (const v of views) {
    if (
      f.refund_owed === v.refund_owed &&
      f.status.length === v.status.length &&
      v.status.every((s) => f.status.includes(s))
    ) {
      return v.key
    }
  }
  return null
}
