"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { NativeSelect } from "@/components/ui/common/Field"
import { Card, Page } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { Job, PresignResponse } from "@/lib/api/types"
import { asApiError, useApi } from "@/lib/api/use-api"
import {
  guessMapping,
  importFields,
  mappingForApi,
  mappingProblem,
  previewCSV,
  previewRows,
} from "@/lib/catalog/import"
import { sha256Hex, xhrPut } from "@/lib/catalog/upload"

// P1-074: upload, preview, map, watch, download errors (04-api-spec.md §7.6).

type Step = "choose" | "map" | "running"

export default function ImportPage() {
  const api = useApi()
  const [step, setStep] = useState<Step>("choose")
  const [file, setFile] = useState<File | null>(null)
  const [header, setHeader] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [onConflict, setOnConflict] = useState<"update" | "error">("update")
  const [upload, setUpload] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const problem = mappingProblem(mapping)

  async function choose(f: File) {
    setFile(f)
    try {
      const preview = await previewCSV(f)
      setHeader(preview.header)
      setRows(preview.rows)
      setMapping(guessMapping(preview.header))
      setStep("map")
    } catch {
      setError(asApiError(new Error("The file could not be read as CSV.")))
    }
  }

  async function start() {
    if (!file) return
    setStep("running")
    try {
      const presign = await api<PresignResponse>("/v1/media/presign", {
        method: "POST",
        body: {
          purpose: "product_import",
          mime_type: file.type || "text/csv",
          bytes: file.size,
          sha256: await sha256Hex(file),
        },
      })
      await xhrPut(
        presign.upload_url,
        new File([file], file.name, { type: file.type || "text/csv" }),
        setUpload,
      )
      const { job_id } = await api<{ job_id: string }>("/v1/products/import", {
        method: "POST",
        body: {
          r2_key: presign.r2_key,
          column_mapping: mappingForApi(mapping),
          on_conflict: onConflict,
        },
      })
      setJobId(job_id)
    } catch (err) {
      setError(asApiError(err))
      setStep("map")
    }
  }

  // Poll the job until it finishes (BR-060); every GET signs a fresh link to
  // errors.csv (BR-063).
  useEffect(() => {
    if (!jobId) return
    let stop = false
    const tick = async () => {
      try {
        const j = await api<Job>(`/v1/jobs/${jobId}`)
        if (stop) return
        setJob(j)
        if (j.state === "queued" || j.state === "running")
          setTimeout(tick, 1000)
      } catch (err) {
        if (!stop) setError(asApiError(err))
      }
    }
    void tick()
    return () => {
      stop = true
    }
  }, [api, jobId])

  return (
    <Page
      title="Import products"
      description="Upload a CSV from your spreadsheet. Rows with the same title become one product; option columns become its variants."
    >
      <Stepper current={step} />
      <ErrorNotice error={error} title="Import failed" />

      {step === "choose" && (
        <Card className="p-6">
          <label className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-theme-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              CSV file (up to 50 MB; comma or semicolon separated)
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="text-theme-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
              onChange={(e) =>
                e.target.files?.[0] && void choose(e.target.files[0])
              }
            />
          </label>
        </Card>
      )}

      {step === "map" && (
        <Card className="p-6">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            Showing the first {Math.min(rows.length, previewRows)} rows of{" "}
            {file?.name}. Map each column to a field; prices are in rupiah.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm" aria-label="Preview">
              <thead>
                <tr>
                  {header.map((h) => (
                    <th key={h} className="min-w-40 p-1 text-left align-bottom">
                      <div className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {h}
                      </div>
                      <MappingSelect
                        value={mapping[h] ?? ""}
                        onChange={(t) => setMapping({ ...mapping, [h]: t })}
                        column={h}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-100 dark:border-white/[0.05]"
                  >
                    {header.map((_, j) => (
                      <td
                        key={j}
                        className="p-1 text-theme-sm text-gray-700 dark:text-gray-300"
                      >
                        {r[j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-400">
              A SKU that already exists:
              <NativeSelect
                className="!h-9"
                value={onConflict}
                onChange={(e) =>
                  setOnConflict(e.target.value as "update" | "error")
                }
              >
                <option value="update">updates that variant</option>
                <option value="error">is reported as an error</option>
              </NativeSelect>
            </label>
            {problem && (
              <p className="text-sm text-error-600 dark:text-error-400">
                {problem}
              </p>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStep("choose")}
              >
                Choose another file
              </Button>
              <Button size="sm" disabled={Boolean(problem)} onClick={start}>
                Import
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "running" && (
        <Card className="p-6">
          {!jobId ? (
            <>
              <p className="text-theme-sm text-gray-700 dark:text-gray-300">
                Uploading {file?.name}…
              </p>
              <progress
                className="mt-2 h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-500 [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-800 [&::-webkit-progress-value]:bg-brand-500"
                value={upload}
                max={1}
                aria-label="Upload progress"
              />
            </>
          ) : !job || job.state === "queued" || job.state === "running" ? (
            <>
              <p className="text-theme-sm text-gray-700 dark:text-gray-300">
                Importing… {job?.processed ?? 0}
                {job?.total ? ` of ${job.total}` : ""} rows
              </p>
              <progress
                className="mt-2 h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-500 [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-800 [&::-webkit-progress-value]:bg-brand-500"
                value={job?.processed ?? 0}
                max={job?.total ?? 1}
                aria-label="Import progress"
              />
            </>
          ) : job.state === "failed" ? (
            <p
              role="alert"
              className="text-theme-sm text-error-600 dark:text-error-400"
            >
              {job.error?.detail ?? "The import failed."}
            </p>
          ) : (
            <ImportResult
              job={job}
              onRefresh={() => api<Job>(`/v1/jobs/${jobId}`).then(setJob)}
            />
          )}
        </Card>
      )}
    </Page>
  )
}

const steps: { key: Step; label: string }[] = [
  { key: "choose", label: "Choose file" },
  { key: "map", label: "Map columns" },
  { key: "running", label: "Import" },
]

/** TailAdmin has no stepper; three numbered circles with connectors. */
function Stepper({ current }: { current: Step }) {
  const at = steps.findIndex((s) => s.key === current)
  return (
    <ol className="mb-6 flex items-center gap-3" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-3">
          {i > 0 && (
            <span
              aria-hidden
              className="h-px w-8 bg-gray-200 dark:bg-gray-800"
            />
          )}
          <span
            aria-current={i === at ? "step" : undefined}
            className="flex items-center gap-2 text-theme-sm"
          >
            <span
              className={
                i < at
                  ? "flex size-8 items-center justify-center rounded-full bg-brand-500 text-white"
                  : i === at
                    ? "flex size-8 items-center justify-center rounded-full text-brand-500 ring-2 ring-inset ring-brand-500"
                    : "flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"
              }
            >
              {i + 1}
            </span>
            <span
              className={
                i === at
                  ? "font-medium text-gray-800 dark:text-white/90"
                  : "text-gray-500 dark:text-gray-400"
              }
            >
              {s.label}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function MappingSelect({
  value,
  onChange,
  column,
}: {
  value: string
  onChange: (t: string) => void
  column: string
}) {
  const isOption = value.startsWith("option:")
  return (
    <div className="flex flex-col gap-1">
      <NativeSelect
        aria-label={`Field for ${column}`}
        value={isOption ? "option" : value}
        onChange={(e) =>
          onChange(e.target.value === "option" ? "option:" : e.target.value)
        }
      >
        {importFields.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </NativeSelect>
      {isOption && (
        <Input
          className="!h-9"
          aria-label={`Option name for ${column}`}
          placeholder="Colour, Size…"
          value={value.slice(7)}
          onChange={(e) => onChange(`option:${e.target.value}`)}
        />
      )}
    </div>
  )
}

function ImportResult({ job, onRefresh }: { job: Job; onRefresh: () => void }) {
  const r = (job.result ?? {}) as {
    created?: number
    updated?: number
    error_report_url?: string | null
  }
  return (
    <div className="flex flex-col gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
      <p className="font-medium text-gray-800 dark:text-white/90">
        Import finished.
      </p>
      <p>
        {r.created ?? 0} variants created, {r.updated ?? 0} updated,{" "}
        {job.failed} rows failed.
      </p>
      {r.error_report_url && (
        <p>
          <a
            href={r.error_report_url}
            className="text-brand-500 underline hover:text-brand-600 dark:text-brand-400"
          >
            Download the failed rows (errors.csv)
          </a>{" "}
          — each with its line number and the reason. The link works for 15
          minutes; reload this page for a new one.
        </p>
      )}
      <Link
        href="/products"
        className="text-brand-500 underline hover:text-brand-600 dark:text-brand-400"
      >
        Back to products
      </Link>
    </div>
  )
}
