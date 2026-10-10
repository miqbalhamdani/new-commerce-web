"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field } from "@/components/ui/common/Field"
import { MultiSelect } from "@/components/ui/common/Select"
import { ProgressBar } from "@/components/ui/common/ProgressBar"
import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { OrderStatus } from "@/lib/api/types"
import { asApiError, useApi, useJob } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import { dateInputRFC3339 } from "@/lib/format"
import { filtersFromQuery, statusValues } from "@/lib/orders/filters"

// P1-112: the accounting export (04-api-spec.md §5.6). One CSV row per order
// line (BR-065); the download link lives 15 minutes and every read of the
// finished job signs a fresh one (BR-063), so the job id sits in the URL and
// a reload just polls it again.

export default function ExportPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrderExport />
    </Suspense>
  )
}

function OrderExport() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const canExport = useCan("exports:read")
  const api = useApi()

  // Seeded from the order list's filters when its Export button brought us here.
  const seed = filtersFromQuery(params)
  const [status, setStatus] = useState<OrderStatus[]>(seed.status)
  const [q, setQ] = useState(seed.q)
  const [refundOwed] = useState(seed.refund_owed)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  const jobId = params.get("job")
  const { job, error: jobError, refresh } = useJob(jobId)

  if (!canExport) {
    return (
      <Page title="Export orders">
        <Empty title="You don't have access to exports." />
      </Page>
    )
  }

  async function start() {
    setBusy(true)
    try {
      const { job_id } = await api<{ job_id: string }>("/v1/orders/export", {
        method: "POST",
        body: {
          ...(status.length ? { status } : {}),
          ...(refundOwed ? { refund_owed: true } : {}),
          ...(q.trim() ? { q: q.trim() } : {}),
          ...(from ? { placed_from: dateInputRFC3339(from) } : {}),
          ...(to ? { placed_to: dateInputRFC3339(to, true) } : {}),
        },
      })
      setError(null)
      router.replace(`${pathname}?job=${job_id}`)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const result = (job?.result ?? {}) as {
    download_url?: string
    rows?: number
  }

  return (
    <Page
      back={
        <Link
          href="/orders"
          className="text-theme-sm text-gray-500 hover:text-brand-500 dark:text-gray-400"
        >
          ← Orders
        </Link>
      }
      title="Export orders"
      description="One CSV row per order line, for the bookkeeping."
    >
      {jobId ? (
        <Card className="p-5">
          {!job && !jobError && <Loading />}
          <ErrorNotice error={jobError} title="Could not read the export job" />
          {job && (job.state === "queued" || job.state === "running") && (
            <>
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Exporting…
              </p>
              <ProgressBar
                className="mt-2"
                value={job.processed}
                max={job.total ?? 1}
                label="Export progress"
              />
            </>
          )}
          {job?.state === "failed" && (
            <p role="alert" className="text-theme-sm text-error-500">
              {job.error?.detail ?? "The export failed."}
            </p>
          )}
          {job?.state === "done" && (
            <div className="flex flex-col gap-3">
              <p className="text-theme-sm text-gray-700 dark:text-gray-300">
                Done — {result.rows ?? job.processed} rows. The link works for
                15 minutes.
              </p>
              <div className="flex flex-wrap gap-3">
                {result.download_url && (
                  <a
                    href={result.download_url}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
                  >
                    Download CSV
                  </a>
                )}
                <Button size="sm" variant="outline" onClick={() => void refresh()}>
                  Get a new link
                </Button>
              </div>
            </div>
          )}
          <div className="mt-4">
            <button
              type="button"
              className="text-theme-sm text-gray-500 underline hover:text-brand-500 dark:text-gray-400"
              onClick={() => router.replace(pathname)}
            >
              Start a new export
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex flex-col gap-4">
            <Field
              id="export-status"
              label="Status"
              hint={refundOwed ? "Exporting the refund-owed view." : "Empty means every status."}
            >
              <MultiSelect
                id="export-status"
                placeholder="Any status"
                value={status}
                onChange={(v) => setStatus(v as OrderStatus[])}
                options={statusValues.map((s) => ({ value: s, label: s }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="export-from" label="Placed from" hint="Midnight WIB.">
                <Input
                  id="export-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field id="export-to" label="Placed to" hint="Inclusive, end of day WIB.">
                <Input
                  id="export-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
            <Field id="export-q" label="Search" hint="Optional; same match as the list.">
              <Input id="export-q" value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
            <ErrorNotice error={error} title="Could not start the export" />
            <div>
              <Button onClick={() => void start()} isLoading={busy}>
                Start export
              </Button>
            </div>
          </div>
        </Card>
      )}
    </Page>
  )
}
