"use client"

import { useState } from "react"

import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { DatePicker } from "@/components/ui/common/DatePicker"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field } from "@/components/ui/common/Field"
import { ProgressBar } from "@/components/ui/common/ProgressBar"
import { MultiSelect } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { OrderStatus } from "@/lib/api/types"
import { asApiError, useApi, useJob } from "@/lib/api/use-api"
import { dateInputRFC3339 } from "@/lib/format"
import { statusValues, type OrderFilters } from "@/lib/orders/filters"

// P1-112: the accounting export (04-api-spec.md §5.6), opened from the order
// list and seeded with its filters. One CSV row per order line (BR-065); the
// download link lives 15 minutes and every read of the finished job signs a
// fresh one (BR-063). Mount it only while open: the seed is read once.

export function ExportDialog({
  seed,
  onClose,
}: {
  seed: OrderFilters
  onClose: () => void
}) {
  const api = useApi()
  const [status, setStatus] = useState<OrderStatus[]>(seed.status)
  const [q, setQ] = useState(seed.q)
  const refundOwed = seed.refund_owed
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const { job, error: jobError, refresh } = useJob(jobId)

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
      setJobId(job_id)
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
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Export orders"
      description="One CSV row per order line, for the bookkeeping."
      footer={
        jobId ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setJobId(null)}>
              Start a new export
            </Button>
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void start()} isLoading={busy}>
              Start export
            </Button>
          </>
        )
      }
    >
      {jobId ? (
        <div className="flex flex-col gap-3">
          <ErrorNotice error={jobError} title="Could not read the export job" />
          {(!job || job.state === "queued" || job.state === "running") &&
            !jobError && (
              <>
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                  Exporting…
                </p>
                <ProgressBar
                  value={job?.processed ?? 0}
                  max={job?.total ?? 1}
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
            <>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refresh()}
                >
                  Get a new link
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field
            id="export-status"
            label="Status"
            hint={
              refundOwed
                ? "Exporting the refund-owed view."
                : "Empty means every status."
            }
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
              <DatePicker id="export-from" value={from} onChange={setFrom} />
            </Field>
            <Field
              id="export-to"
              label="Placed to"
              hint="Inclusive, end of day WIB."
            >
              <DatePicker id="export-to" value={to} onChange={setTo} />
            </Field>
          </div>
          <Field
            id="export-q"
            label="Search"
            hint="Optional; same match as the list."
          >
            <Input
              id="export-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Field>
          <ErrorNotice error={error} title="Could not start the export" />
        </div>
      )}
    </Dialog>
  )
}
