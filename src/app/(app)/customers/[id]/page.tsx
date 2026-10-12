"use client"

import Link from "next/link"
import { use, useCallback, useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Empty, Loading, Page, Section } from "@/components/ui/common/Page"
import { OrderTable } from "@/components/ui/orders/OrderTable"
import type { ApiError } from "@/lib/api/client"
import type { CustomerDetail } from "@/lib/api/types"
import { asApiError, useApi, useJob, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"

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
      actions={
        canPurge &&
        !data.purged_at && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setPurging(true)}
          >
            Delete personal data
          </Button>
        )
      }
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
      <PurgeDialog
        customer={purging ? data : null}
        onClose={closePurge}
        onDone={reload}
      />
    </Page>
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
