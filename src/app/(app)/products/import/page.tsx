"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
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
      <ErrorNotice error={error} title="Import failed" />

      {step === "choose" && (
        <Card className="p-6">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">
              CSV file (up to 50 MB; comma or semicolon separated)
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) =>
                e.target.files?.[0] && void choose(e.target.files[0])
              }
            />
          </label>
        </Card>
      )}

      {step === "map" && (
        <Card className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing the first {Math.min(rows.length, previewRows)} rows of{" "}
            {file?.name}. Map each column to a field; prices are in rupiah.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm" aria-label="Preview">
              <thead>
                <tr>
                  {header.map((h) => (
                    <th key={h} className="min-w-40 p-1 text-left align-bottom">
                      <div className="text-xs text-gray-500">{h}</div>
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
                    className="border-t border-gray-100 dark:border-gray-900"
                  >
                    {header.map((_, j) => (
                      <td
                        key={j}
                        className="p-1 text-gray-700 dark:text-gray-300"
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
            <label className="flex items-center gap-2 text-sm">
              A SKU that already exists:
              <NativeSelect
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
              <p className="text-sm text-red-700 dark:text-red-400">
                {problem}
              </p>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setStep("choose")}>
                Choose another file
              </Button>
              <Button disabled={Boolean(problem)} onClick={start}>
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
              <p className="text-sm">Uploading {file?.name}…</p>
              <progress
                className="mt-2 w-full"
                value={upload}
                max={1}
                aria-label="Upload progress"
              />
            </>
          ) : !job || job.state === "queued" || job.state === "running" ? (
            <>
              <p className="text-sm">
                Importing… {job?.processed ?? 0}
                {job?.total ? ` of ${job.total}` : ""} rows
              </p>
              <progress
                className="mt-2 w-full"
                value={job?.processed ?? 0}
                max={job?.total ?? 1}
                aria-label="Import progress"
              />
            </>
          ) : job.state === "failed" ? (
            <p role="alert" className="text-sm text-red-700">
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
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-medium">Import finished.</p>
      <p>
        {r.created ?? 0} variants created, {r.updated ?? 0} updated,{" "}
        {job.failed} rows failed.
      </p>
      {r.error_report_url && (
        <p>
          <a href={r.error_report_url} className="text-blue-600 underline">
            Download the failed rows (errors.csv)
          </a>{" "}
          — each with its line number and the reason. The link works for 15
          minutes; reload this page for a new one.
        </p>
      )}
      <Link href="/products" className="text-blue-600 underline">
        Back to products
      </Link>
    </div>
  )
}
