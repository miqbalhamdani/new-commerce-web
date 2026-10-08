"use client"

import Link from "next/link"

import Badge from "@/components/ui/badge/Badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/common/Field"
import type { ProductListItem } from "@/lib/api/types"
import { formatMoney } from "@/lib/format"

const statusBadge = {
  draft: "light",
  active: "success",
  archived: "warning",
} as const

const headerCell =
  "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
const bodyCell = "px-5 py-4 text-start text-theme-sm"

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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              {selectable && (
                <TableCell isHeader className={`${headerCell} w-8`}>
                  <span className="sr-only">Select</span>
                </TableCell>
              )}
              <TableCell isHeader className={headerCell}>
                Product
              </TableCell>
              <TableCell isHeader className={headerCell}>
                Category
              </TableCell>
              <TableCell isHeader className={headerCell}>
                Brand
              </TableCell>
              <TableCell isHeader className={headerCell}>
                Status
              </TableCell>
              <TableCell isHeader className={`${headerCell} text-right`}>
                Variants
              </TableCell>
              <TableCell isHeader className={`${headerCell} text-right`}>
                Price
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {rows.map((p) => (
              <TableRow key={p.id}>
                {selectable && (
                  <TableCell className={bodyCell}>
                    <Checkbox
                      aria-label={`Select ${p.title}`}
                      checked={selectable.selected.has(p.id)}
                      onChange={() => selectable.toggle(p.id)}
                    />
                  </TableCell>
                )}
                <TableCell className={bodyCell}>
                  <div className="flex items-center gap-3">
                    {p.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- derivatives are already sized
                      <img
                        src={p.cover_url}
                        alt=""
                        className="size-10 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="size-10 rounded-lg bg-gray-100 dark:bg-gray-800" />
                    )}
                    <div>
                      <Link
                        href={`/products/${p.id}`}
                        className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                      >
                        {p.title}
                      </Link>
                      {selectable?.failed.get(p.id) && (
                        <p role="alert" className="text-theme-xs text-error-500">
                          {selectable.failed.get(p.id)}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className={`${bodyCell} text-gray-500 dark:text-gray-400`}>
                  {p.categories.length ? (
                    p.categories.map((c) => c.name).join(", ")
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell className={`${bodyCell} text-gray-500 dark:text-gray-400`}>
                  {p.brand?.name ?? "—"}
                </TableCell>
                <TableCell className={bodyCell}>
                  <Badge size="sm" color={statusBadge[p.status]}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell
                  className={`${bodyCell} text-right tabular-nums text-gray-500 dark:text-gray-400`}
                >
                  {p.variant_count}
                </TableCell>
                <TableCell
                  className={`${bodyCell} text-right tabular-nums text-gray-500 dark:text-gray-400`}
                >
                  {p.price_min === p.price_max
                    ? formatMoney(p.price_min)
                    : `${formatMoney(p.price_min)} – ${formatMoney(p.price_max)}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
