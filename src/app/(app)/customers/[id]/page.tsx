"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { use, useCallback, useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Card, Loading, Page } from "@/components/ui/common/Page"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { OrderTable } from "@/components/ui/orders/OrderTable"
import type { ApiError } from "@/lib/api/client"
import type { CustomerDetail } from "@/lib/api/types"
import { asApiError, useApi, useJob, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"
import { cx } from "@/lib/utils"

// P1-111: one customer and their orders, newest first (§5.5; BR-092).
// P1-215: the owner erases their personal data (BR-097).

export default function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, error, loading, reload } = useResource<CustomerDetail>(
    `/v1/customers/${id}`,
  )
  const { tenant } = useSession()
  const canPurge = useCan("customers:purge")
  const [purging, setPurging] = useState(false)
  const closePurge = useCallback(() => setPurging(false), [])

  if (loading && !data) return <Loading />
  if (!data)
    return (
      <div className="p-8">
        <ErrorNotice error={error} title="Could not load the customer" />
      </div>
    )

  const since = formatDateTime(data.created_at, tenant?.timezone)
  const initials = data.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <Page
      wide
      title="Customer"
    >
      <div className="flex flex-col gap-6">
        {data.purged_at && (
          <p
            role="status"
            className="rounded-lg border border-gray-200 px-4 py-3 text-theme-sm text-gray-600 dark:border-gray-800 dark:text-gray-400"
          >
            Personal data deleted{" "}
            {formatDateTime(data.purged_at, tenant?.timezone)}. Their orders
            keep totals and lines, without name, contact or street address
            (BR-097).
          </p>
        )}
        {/* Profile-page layout: avatar header, then label-over-value grid.
            No edit: customers manage their own account (BR-092). */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div
              aria-hidden
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-600 sm:size-20 dark:bg-brand-500/15 dark:text-brand-400"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {data.name}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-theme-sm text-gray-500 dark:text-gray-400">
                <span>Customer since {since}</span>
                <span
                  aria-hidden
                  className="hidden h-3.5 w-px bg-gray-300 sm:block dark:bg-gray-700"
                />
                <span>
                  {data.order_count}{" "}
                  {data.order_count === 1 ? "order" : "orders"}
                </span>
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Item label="Email">{data.email}</Item>
            <Item label="Phone">{data.phone ?? "—"}</Item>
            <Item label="Orders">{data.order_count}</Item>
            <Item label="Customer since">{since}</Item>
          </dl>
        </Card>

        <CustomerOrders orders={data.orders} timezone={tenant?.timezone} />

        {canPurge && !data.purged_at && (
          <Card className="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Personal data
            </h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  Delete personal data
                </p>
                <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
                  Erase name, contact and address. Orders keep their totals.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="!text-error-600 !ring-error-300 hover:!bg-error-50 dark:!text-error-500 dark:!ring-error-500/40 dark:hover:!bg-error-500/10"
                onClick={() => setPurging(true)}
              >
                Delete personal data
              </Button>
            </div>
          </Card>
        )}
      </div>
      <PurgeDialog
        customer={purging ? data : null}
        onClose={closePurge}
        onDone={reload}
      />
    </Page>
  )
}

const pageSize = 10

/** The customer's orders (newest first, up to 50 from the API) in one card:
    title and search on top, the table edge to edge, pages at the bottom.
    The API hands all of them over at once, so search and paging are local. */
function CustomerOrders({
  orders,
  timezone,
}: {
  orders: CustomerDetail["orders"]
  timezone?: string
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)

  const q = query.trim().toLowerCase()
  const matches = q
    ? orders.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.status.includes(q) ||
          o.source.includes(q),
      )
    : orders
  const pages = Math.max(1, Math.ceil(matches.length / pageSize))
  const current = Math.min(page, pages)
  const rows = matches.slice((current - 1) * pageSize, current * pageSize)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
          Orders
        </h2>
        {orders.length > 0 && (
          <SearchInput
            className="sm:w-72"
            aria-label="Search orders"
            placeholder="Search order, status…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-white/[0.05]">
        {rows.length > 0 ? (
          <OrderTable rows={rows} timezone={timezone} bare />
        ) : (
          <p className="px-6 py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
            {orders.length === 0 ? "No orders yet" : "No orders match."}
          </p>
        )}
      </div>

      {pages > 1 && (
        <nav
          aria-label="Orders pages"
          className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 sm:px-6 dark:border-white/[0.05]"
        >
          <Button
            size="sm"
            variant="outline"
            startIcon={<ArrowLeft className="size-4" />}
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <ol className="flex items-center gap-1">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <li key={n}>
                <button
                  type="button"
                  aria-current={n === current ? "page" : undefined}
                  onClick={() => setPage(n)}
                  className={cx(
                    "flex size-10 items-center justify-center rounded-lg text-theme-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                    n === current
                      ? "bg-brand-500 text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5",
                  )}
                >
                  {n}
                </button>
              </li>
            ))}
          </ol>
          <Button
            size="sm"
            variant="outline"
            endIcon={<ArrowRight className="size-4" />}
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </Card>
  )
}

/** One label-over-value pair in the profile grid. */
function Item({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-theme-sm font-medium text-gray-800 dark:text-white/90">
        {children}
      </dd>
    </div>
  )
}

/** The confirm, then the job until it finishes (BR-060). */
function PurgeDialog({
  customer,
  onClose,
  onDone,
}: {
  customer: CustomerDetail | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const { job, error: jobError } = useJob(jobId)
  const running = busy || job?.state === "queued" || job?.state === "running"

  useEffect(() => {
    if (job?.state !== "done") return
    setJobId(null)
    onClose()
    onDone()
  }, [job, onClose, onDone])

  async function purge() {
    if (!customer) return
    setBusy(true)
    try {
      const { job_id } = await api<{ job_id: string }>(
        `/v1/customers/${customer.id}/purge`,
        { method: "POST" },
      )
      setError(null)
      setJobId(job_id)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={customer !== null}
      onOpenChange={(open) => !open && !running && onClose()}
      dismissible={!running}
      title={`Delete ${customer?.name ?? ""}'s personal data?`}
      description="Their name, email, phone, street address and order notes are erased from their account and their orders, including guest orders placed with the same email, and they are signed out everywhere. Order totals and lines stay. This can't be undone."
      footer={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={running}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            isLoading={running}
            onClick={purge}
          >
            Delete personal data
          </Button>
        </>
      }
    >
      <ErrorNotice error={error ?? jobError} />
      {job?.state === "failed" && (
        <p role="alert" className="text-theme-sm text-error-500">
          {job.error?.detail ??
            "Deleting failed. Nothing was changed; try again."}
        </p>
      )}
    </Dialog>
  )
}
