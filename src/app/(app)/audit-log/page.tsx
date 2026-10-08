"use client"

import { useState } from "react"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import type { AuditPage } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { changesOf, show } from "@/lib/audit"
import { useCan, useSession } from "@/lib/auth/session"
import { formatDateTime } from "@/lib/format"

// P1-078: who changed what (04-api-spec.md §4, BR-018).

export default function AuditLogPage() {
  const canRead = useCan("audit_log:read")
  const { tenant } = useSession()
  const [filters, setFilters] = useState({
    subject_type: "",
    subject_id: "",
    from: "",
    to: "",
  })
  const [cursor, setCursor] = useState<string | null>(null)
  const query = new URLSearchParams({ limit: "50" })
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v)
  if (cursor) query.set("cursor", cursor)
  const { data, error, loading } = useResource<AuditPage>(
    canRead ? `/v1/audit-log?${query}` : null,
  )

  if (!canRead)
    return (
      <Page title="Audit log">
        <Empty title="You don't have access to the audit log." />
      </Page>
    )

  const set = (k: keyof typeof filters, v: string) => {
    setFilters({ ...filters, [k]: v })
    setCursor(null)
  }

  return (
    <Page
      wide
      title="Audit log"
      description="Every change made in the admin, newest first."
    >
      <div className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          What
          <Input
            placeholder="product, brand, user…"
            value={filters.subject_type}
            onChange={(e) => set("subject_type", e.target.value.trim())}
          />
        </label>
        <label className="flex flex-col gap-1">
          Record id
          <Input
            value={filters.subject_id}
            onChange={(e) => set("subject_id", e.target.value.trim())}
          />
        </label>
        <label className="flex flex-col gap-1">
          From
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => set("from", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Before
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => set("to", e.target.value)}
          />
        </label>
      </div>
      <ErrorNotice error={error} title="Could not load the audit log" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="Nothing recorded for these filters" />
      ) : data ? (
        <TableRoot>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>When</TableHeaderCell>
                <TableHeaderCell>Who</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>On</TableHeaderCell>
                <TableHeaderCell>Change</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((e, i) => (
                <TableRow key={i} className="align-top">
                  <TableCell className="text-gray-500">
                    {formatDateTime(e.created_at, tenant?.timezone)}
                  </TableCell>
                  <TableCell>
                    {e.actor?.name ?? (
                      <span className="text-gray-500">System</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.action}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{e.subject_type}</div>
                    <div className="text-gray-500">{e.subject_id}</div>
                  </TableCell>
                  <TableCell className="whitespace-normal text-xs">
                    <ul>
                      {changesOf(e).map((c) => (
                        <li key={c.field}>
                          <span className="font-medium">{c.field}</span>:{" "}
                          {c.before !== undefined && (
                            <span className="text-red-700 line-through dark:text-red-400">
                              {show(c.before)}
                            </span>
                          )}
                          {c.before !== undefined &&
                            c.after !== undefined &&
                            " → "}
                          {c.after !== undefined && (
                            <span className="text-green-700 dark:text-green-400">
                              {show(c.after)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      ) : null}
      {data?.next_cursor && (
        <div className="mt-4 flex justify-end">
          <Button
            variant="secondary"
            onClick={() => setCursor(data.next_cursor)}
          >
            Older entries
          </Button>
        </div>
      )}
    </Page>
  )
}
