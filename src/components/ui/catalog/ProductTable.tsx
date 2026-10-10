"use client"

import { Archive } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import Badge from "@/components/ui/badge/Badge"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/common/Field"
import { RowMenu } from "@/components/ui/common/RowMenu"
import {
  bodyRows,
  headerRow,
  ListTable,
  td,
  th,
} from "@/components/ui/common/Listing"
import { PencilIcon } from "@/icons"
import type { ProductListItem } from "@/lib/api/types"
import { formatMoney } from "@/lib/format"

const statusBadge = {
  draft: "light",
  active: "success",
  archived: "warning",
} as const

const headerCell = th
const bodyCell = td

/**
 * The catalog table (P1-033): each row's main-tree categories, brand, status,
 * live variant count and price range. selectable adds the checkboxes and the
 * per-row failure messages bulk actions need (P1-076). onArchive adds the row
 * menu (Edit, Archive). A row opens the product.
 */
export function ProductTable({
  rows,
  selectable,
  onArchive,
}: {
  rows: ProductListItem[]
  selectable?: {
    selected: Set<string>
    toggle: (id: string) => void
    failed: Map<string, string>
  }
  onArchive?: (p: ProductListItem) => void
}) {
  const router = useRouter()
  // Clicks on the checkbox, the title link and the menu stay theirs.
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  return (
    <ListTable>
      <TableHeader className={headerRow}>
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
          {onArchive && (
            <TableCell isHeader className={`${headerCell} w-px`}>
              <span className="sr-only">Actions</span>
            </TableCell>
          )}
        </TableRow>
      </TableHeader>
      <TableBody className={bodyRows}>
        {rows.map((p) => (
          <TableRow
            key={p.id}
            onClick={() => router.push(`/products/${p.id}`)}
            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
          >
            {selectable && (
              <TableCell className={bodyCell}>
                <span className="inline-flex" onClick={stop}>
                  <Checkbox
                    aria-label={`Select ${p.title}`}
                    checked={selectable.selected.has(p.id)}
                    onChange={() => selectable.toggle(p.id)}
                  />
                </span>
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
                    onClick={stop}
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
            <TableCell
              className={`${bodyCell} text-gray-500 dark:text-gray-400`}
            >
              {p.categories.length ? (
                p.categories.map((c) => c.name).join(", ")
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </TableCell>
            <TableCell
              className={`${bodyCell} text-gray-500 dark:text-gray-400`}
            >
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
            {onArchive && (
              <TableCell className={`${bodyCell} !py-2 text-right`}>
                <RowMenu
                  label={`Actions for ${p.title}`}
                  actions={[
                    {
                      label: "Edit",
                      icon: <PencilIcon />,
                      onSelect: () => router.push(`/products/${p.id}`),
                    },
                    ...(p.status === "archived"
                      ? []
                      : [
                          {
                            label: "Archive",
                            icon: <Archive />,
                            destructive: true,
                            onSelect: () => onArchive(p),
                          },
                        ]),
                  ]}
                />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </ListTable>
  )
}
