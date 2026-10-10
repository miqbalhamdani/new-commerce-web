"use client"

import Link from "next/link"
import { use } from "react"

import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Empty, Loading, Page, Section } from "@/components/ui/common/Page"
import { OrderTable } from "@/components/ui/orders/OrderTable"
import type { CustomerDetail } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useSession } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"

// P1-111: one customer and their orders, newest first (§5.5; BR-092).

export default function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, error, loading } = useResource<CustomerDetail>(
    `/v1/customers/${id}`,
  )
  const { tenant } = useSession()

  if (loading && !data) return <Loading />
  if (!data)
    return (
      <div className="p-8">
        <ErrorNotice error={error} title="Could not load the customer" />
      </div>
    )

  return (
    <Page
      wide
      back={
        <Link
          href="/customers"
          className="text-theme-sm text-gray-500 hover:text-brand-500 dark:text-gray-400"
        >
          ← Customers
        </Link>
      }
      title={data.name}
      description={`Customer since ${formatDateTime(data.created_at, tenant?.timezone)}.`}
    >
      <div className="flex flex-col gap-6">
        <Section title="Profile" description="Read-only: customers manage their own account (BR-092).">
          <dl className="grid gap-2 text-theme-sm sm:grid-cols-3">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Email</dt>
              <dd>{data.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Phone</dt>
              <dd>{data.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Orders</dt>
              <dd>{data.order_count}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Orders" description="Newest first, up to the last 50.">
          {data.orders.length === 0 ? (
            <Empty title="No orders yet" />
          ) : (
            <OrderTable rows={data.orders} timezone={tenant?.timezone} />
          )}
        </Section>
      </div>
    </Page>
  )
}
