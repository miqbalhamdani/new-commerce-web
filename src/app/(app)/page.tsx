"use client"

import { PackageCheck, RotateCcw, Truck, Wallet } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import {
  Card,
  Empty,
  Loading,
  Page,
  Section,
} from "@/components/ui/common/Page"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { SegmentedTabs } from "@/components/ui/common/SegmentedTabs"
import { SalesChart, dayLabel } from "@/components/ui/dashboard/SalesChart"
import { ShareBar } from "@/components/ui/dashboard/ShareBar"
import { StatTile } from "@/components/ui/dashboard/StatTile"
import { TopProducts } from "@/components/ui/dashboard/TopProducts"
import { OrderTable } from "@/components/ui/orders/OrderTable"
import { useResource } from "@/lib/api/use-api"
import type { Dashboard, OrderPage } from "@/lib/api/types"
import { useCan, useSession } from "@/lib/auth/session"
import {
  change,
  periodOptions,
  periodRange,
  type PeriodDays,
} from "@/lib/dashboard/period"
import { formatMoney } from "@/lib/format"

const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`

/**
 * P1-114: the home of the admin, laid out like TailAdmin's Sales and
 * Logistics dashboards. What needs action now opens the order list's saved
 * views; the rest is one period's sales against the period before, from
 * GET /v1/dashboard (04-api-spec.md §5.7, BR-066). Nothing here is stock:
 * there is none (BR-017).
 */
export default function DashboardPage() {
  const canRead = useCan("orders:read")
  const { tenant } = useSession()
  const [days, setDays] = useState<PeriodDays>("30")
  const range = useMemo(() => periodRange(Number(days)), [days])
  const { data, error, loading } = useResource<Dashboard>(
    canRead ? `/v1/dashboard?from=${range.from}&to=${range.to}` : null,
  )
  const latest = useResource<OrderPage>(canRead ? "/v1/orders?limit=5" : null)
  const periodLabel = periodOptions.find((o) => o.value === days)!.label

  if (!canRead) {
    return (
      <Page title="Dashboard">
        <Empty title="You don't have access to orders." />
      </Page>
    )
  }

  return (
    <Page
      title="Dashboard"
      description="What needs doing today, and how sales are going."
      wide
    >
      <ErrorNotice error={error} title="The dashboard did not load" />
      {!data ? (
        !error && <Loading />
      ) : (
        // A new period keeps the last figures on screen, dimmed, until the
        // next ones arrive: no flash of an empty page.
        <div
          className={
            loading ? "opacity-60 transition-opacity" : "transition-opacity"
          }
          aria-busy={loading}
        >
          <NeedsAction n={data.needs_action} />

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Sales
            </h2>
            <SegmentedTabs
              label="Period"
              options={periodOptions}
              value={days}
              onChange={setDays}
            />
          </div>
          <Figures d={data} periodLabel={periodLabel} />

          <div className="mt-4 grid grid-cols-12 gap-4 md:mt-6 md:gap-6">
            <div className="col-span-12 xl:col-span-8">
              <Section
                title="Sales per day"
                description={`Paid orders over the last ${periodLabel}, by the day they were placed.`}
              >
                <SalesChart days={data.daily} />
              </Section>
            </div>
            <div className="col-span-12 flex flex-col gap-4 md:gap-6 xl:col-span-4">
              <Section
                title="Sales by channel"
                description="WhatsApp and other orders typed in by staff, against the website."
              >
                <ShareBar
                  label="Sales by channel"
                  empty="No sales in this period yet."
                  parts={data.by_source.map((s) => ({
                    name:
                      s.source === "manual" ? "WhatsApp & manual" : "Website",
                    value: s.sales,
                    detail: `${formatMoney(s.sales)} · ${count(s.orders, "order", "orders")}`,
                  }))}
                />
              </Section>
              <Section title="Payment methods">
                <ShareBar
                  label="Sales by payment method"
                  empty="No sales in this period yet."
                  parts={data.by_payment_method.map((m) => ({
                    name:
                      m.payment_method === "bank_transfer"
                        ? "Bank transfer"
                        : "Midtrans",
                    value: m.sales,
                    detail: `${formatMoney(m.sales)} · ${count(m.orders, "order", "orders")}`,
                  }))}
                />
              </Section>
            </div>

            <div className="col-span-12 xl:col-span-8">
              <Section
                title="Top products"
                description="The five best sellers this period, by sales."
              >
                <TopProducts products={data.top_products} />
              </Section>
            </div>
            <div className="col-span-12 xl:col-span-4">
              <Section
                title="Customers"
                description="Who bought this period: first-timers, and people who had bought before."
              >
                <ShareBar
                  label="Customers"
                  empty="No customers in this period yet."
                  parts={[
                    {
                      name: "New",
                      value: data.customers.new,
                      detail: count(
                        data.customers.new,
                        "customer",
                        "customers",
                      ),
                    },
                    {
                      name: "Returning",
                      value: data.customers.returning,
                      detail: count(
                        data.customers.returning,
                        "customer",
                        "customers",
                      ),
                    },
                  ]}
                />
              </Section>
            </div>

            <div className="col-span-12">
              <Card>
                <div className="flex items-center justify-between gap-3 p-6 pb-4">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
                    Latest orders
                  </h2>
                  <Link
                    href="/orders"
                    className="text-theme-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    View all
                  </Link>
                </div>
                <ErrorNotice
                  error={latest.error}
                  title="The latest orders did not load"
                />
                {latest.data && latest.data.data.length === 0 ? (
                  <p className="px-6 pb-6 text-theme-sm text-gray-500 dark:text-gray-400">
                    No orders yet.
                  </p>
                ) : (
                  latest.data && (
                    <OrderTable
                      rows={latest.data.data}
                      timezone={tenant?.timezone}
                      bare
                    />
                  )
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}

/** The shop now, whatever the period: each tile opens its saved view (§5.1). */
function NeedsAction({ n }: { n: Dashboard["needs_action"] }) {
  const pending = n.awaiting_payment + n.transfers_to_confirm
  return (
    <section aria-label="Needs action">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
        <StatTile
          label="Awaiting payment"
          value={pending.toLocaleString("en-US")}
          sub={count(
            n.transfers_to_confirm,
            "bank transfer to confirm",
            "bank transfers to confirm",
          )}
          icon={<Wallet className="size-5" />}
          href="/orders?status=pending"
        />
        <StatTile
          label="Ready to ship"
          value={n.ready_to_ship.toLocaleString("en-US")}
          sub="Paid, not shipped yet"
          icon={<PackageCheck className="size-5" />}
          href="/orders?status=paid&status=processing"
        />
        <StatTile
          label="Shipped"
          value={n.shipped.toLocaleString("en-US")}
          sub="On the way to the customer"
          icon={<Truck className="size-5" />}
          href="/orders?status=shipped"
        />
        <StatTile
          label="Needs refund"
          value={n.refund_owed.toLocaleString("en-US")}
          sub="Cancelled after payment"
          icon={<RotateCcw className="size-5" />}
          href="/orders?refund_owed=true"
        />
      </div>
    </section>
  )
}

/** The period's four figures against the period before, each with its days. */
function Figures({ d, periodLabel }: { d: Dashboard; periodLabel: string }) {
  const dates = d.daily.map((x) => dayLabel(x.date))
  const plain = (v: number) => v.toLocaleString("en-US")
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
      <StatTile
        label="Sales"
        value={formatMoney(d.current.sales)}
        delta={change(d.current.sales, d.previous.sales)}
        periodLabel={periodLabel}
        trend={{
          dates,
          values: d.daily.map((x) => x.sales),
          format: formatMoney,
        }}
      />
      <StatTile
        label="Orders"
        value={plain(d.current.orders)}
        delta={change(d.current.orders, d.previous.orders)}
        periodLabel={periodLabel}
        trend={{ dates, values: d.daily.map((x) => x.orders), format: plain }}
      />
      <StatTile
        label="Average order value"
        value={formatMoney(d.current.average_order_value)}
        delta={change(
          d.current.average_order_value,
          d.previous.average_order_value,
        )}
        periodLabel={periodLabel}
      />
      <StatTile
        label="Items sold"
        value={plain(d.current.items_sold)}
        delta={change(d.current.items_sold, d.previous.items_sold)}
        periodLabel={periodLabel}
      />
    </div>
  )
}
