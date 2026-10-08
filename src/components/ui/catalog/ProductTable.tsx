"use client"

import Link from "next/link"

import { Badge } from "@/components/Badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import type { ProductListItem } from "@/lib/api/types"
import { formatMoney } from "@/lib/format"

const statusBadge = {
  draft: "neutral",
  active: "success",
  archived: "warning",
} as const

/**
 * The catalog table (P1-033): each row's main-tree categories, brand, status,
 * live variant count and price range. selectable adds the checkboxes and the
 * per-row failure messages bulk actions need (P1-076).
 */
export function ProductTable({
  rows,
  selectable,
}: {
  rows: ProductListItem[]
  selectable?: {
    selected: Set<string>
    toggle: (id: string) => void
    failed: Map<string, string>
  }
}) {
  return (
    <TableRoot>
      <Table>
        <TableHead>
          <TableRow>
            {selectable && (
              <TableHeaderCell className="w-8">
                <span className="sr-only">Select</span>
              </TableHeaderCell>
            )}
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell>Category</TableHeaderCell>
            <TableHeaderCell>Brand</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell className="text-right">Variants</TableHeaderCell>
            <TableHeaderCell className="text-right">Price</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id}>
              {selectable && (
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.title}`}
                    checked={selectable.selected.has(p.id)}
                    onChange={() => selectable.toggle(p.id)}
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-3">
                  {p.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- derivatives are already sized
                    <img
                      src={p.cover_url}
                      alt=""
                      className="size-9 rounded object-cover"
                    />
                  ) : (
                    <span className="size-9 rounded bg-gray-100 dark:bg-gray-800" />
                  )}
                  <div>
                    <Link
                      href={`/products/${p.id}`}
                      className="font-medium text-gray-900 hover:underline dark:text-gray-50"
                    >
                      {p.title}
                    </Link>
                    {selectable?.failed.get(p.id) && (
                      <p
                        role="alert"
                        className="text-xs text-red-700 dark:text-red-400"
                      >
                        {selectable.failed.get(p.id)}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-gray-600 dark:text-gray-400">
                {p.categories.length ? (
                  p.categories.map((c) => c.name).join(", ")
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-gray-600 dark:text-gray-400">
                {p.brand?.name ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant={statusBadge[p.status]}>{p.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {p.variant_count}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {p.price_min === p.price_max
                  ? formatMoney(p.price_min)
                  : `${formatMoney(p.price_min)} – ${formatMoney(p.price_max)}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableRoot>
  )
}
