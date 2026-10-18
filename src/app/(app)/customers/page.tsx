"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"

import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { Pager } from "@/components/ui/common/Pager"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  bodyRows,
  headerRow,
  ListTable,
  td,
  th,
} from "@/components/ui/common/Listing"
import type { CustomerPage } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import { formatDateTime, formatRelative } from "@/lib/format"
import { PAGE_SIZE, pageFromQuery, withPage } from "@/lib/pagination"

// P1-111: customers, read-only (04-api-spec.md §5.5; BR-092). Staff never
// create accounts or set passwords.

export default function CustomersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomerList />
    </Suspense>
  )
}

function CustomerList() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const q = params.get("q") ?? ""
  const page = pageFromQuery(params)
  const canRead = useCan("customers:read")
  const { tenant } = useSession()
  function search(next: string) {
    router.replace(
      next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname,
    )
  }

  function goPage(n: number) {
    const query = withPage(params, n)
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const query = new URLSearchParams()
  if (q) query.set("q", q)
  query.set("limit", String(PAGE_SIZE))
  if (page > 1) query.set("page", String(page))
  const { data, error, loading } = useResource<CustomerPage>(
    canRead ? `/v1/customers?${query}` : null,
  )

  if (!canRead) {
    return (
      <Page title="Customers">
        <Empty title="You don't have access to customers." />
      </Page>
    )
  }

  return (
    <Page
      wide
      title="Customers"
      description="Storefront accounts, with their order history."
    >
      <div className="mb-4">
        <SearchInput
          aria-label="Search customers"
          placeholder="Name, email or phone"
          className="w-full max-w-xs"
          defaultValue={q}
          onKeyDown={(e) =>
            e.key === "Enter" && search(e.currentTarget.value.trim())
          }
          onBlur={(e) =>
            e.target.value.trim() !== q && search(e.target.value.trim())
          }
        />
      </div>

      <ErrorNotice error={error} title="Could not load customers" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="No customers yet">
          Accounts appear here once the storefront takes orders.
        </Empty>
      ) : data ? (
        <ListTable>
          <TableHeader className={headerRow}>
            <TableRow>
              <TableCell isHeader className={th}>
                Name
              </TableCell>
              <TableCell isHeader className={th}>
                Email
              </TableCell>
              <TableCell isHeader className={th}>
                Phone
              </TableCell>
              <TableCell isHeader className={`${th} text-right`}>
                Orders
              </TableCell>
              <TableCell isHeader className={th}>
                Since
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className={bodyRows}>
            {data.data.map((c) => (
              <TableRow
                key={c.id}
                onClick={() => router.push(`/customers/${c.id}`)}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                <TableCell className={td}>
                  <Link
                    href={`/customers/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                  >
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                  {c.email}
                </TableCell>
                <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                  {c.phone ?? "—"}
                </TableCell>
                <TableCell
                  className={`${td} text-right tabular-nums text-gray-500 dark:text-gray-400`}
                >
                  {c.order_count}
                </TableCell>
                <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                  <span title={formatDateTime(c.created_at, tenant?.timezone)}>
                    {formatRelative(c.created_at)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      ) : null}
      <Pager
        className="mt-4"
        page={page}
        limit={PAGE_SIZE}
        total={data?.total}
        noun="customers"
        onPage={goPage}
      />
    </Page>
  )
}
