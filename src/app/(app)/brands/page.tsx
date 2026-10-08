"use client"

import { useState } from "react"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from "@/components/Table"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { Brand, BrandPage } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"

// P1-031: brands (01-product-requirements.md §4, 04-api-spec.md §6.1).

export default function BrandsPage() {
  const canWrite = useCan("brands:write")
  const api = useApi()
  const [q, setQ] = useState("")
  const [archived, setArchived] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const params = new URLSearchParams({ archived: String(archived), limit: "50" })
  if (q.trim()) params.set("q", q.trim())
  if (cursor) params.set("cursor", cursor)
  const { data, error, loading, reload } = useResource<BrandPage>(`/v1/brands?${params}`)

  const [name, setName] = useState("")
  const [createError, setCreateError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState<Brand | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api("/v1/brands", { method: "POST", body: { name } })
      setName("")
      setCreateError(null)
      reload()
    } catch (err) {
      setCreateError(asApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page title="Brands" description="The labels your products are sold under.">
      {canWrite && !archived && (
        <form onSubmit={create} className="mb-6 flex flex-wrap items-start gap-2">
          <div className="min-w-60 flex-1">
            <Input
              aria-label="New brand name"
              placeholder="New brand name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hasError={Boolean(fieldError(createError, "name"))}
            />
            {createError && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{createError.message}</p>}
          </div>
          <Button type="submit" isLoading={saving} disabled={!name.trim()}>
            Add brand
          </Button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="Search brands"
          placeholder="Search brands"
          className="max-w-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setCursor(null)
          }}
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => {
              setArchived(e.target.checked)
              setCursor(null)
            }}
          />
          Show archived
        </label>
      </div>

      <ErrorNotice error={error} title="Could not load brands" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title={archived ? "No archived brands" : "No brands yet"}>
          {!archived && canWrite && "Add the first one above. A product's brand is optional."}
        </Empty>
      ) : data ? (
        <TableRoot>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Slug</TableHeaderCell>
                {canWrite && !archived && <TableHeaderCell className="text-right">Actions</TableHeaderCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.map((b) => (
                <BrandRow key={b.id} brand={b} canWrite={canWrite && !archived} onArchive={setArchiving} onSaved={reload} />
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      ) : null}
      {data?.next_cursor && (
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setCursor(data.next_cursor)}>
            Next page
          </Button>
        </div>
      )}

      <ArchiveDialog brand={archiving} onClose={() => setArchiving(null)} onDone={reload} />
    </Page>
  )
}

function BrandRow({
  brand,
  canWrite,
  onArchive,
  onSaved,
}: {
  brand: Brand
  canWrite: boolean
  onArchive: (b: Brand) => void
  onSaved: () => void
}) {
  const api = useApi()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(brand.name)
  const [error, setError] = useState<ApiError | null>(null)

  async function save() {
    try {
      await api(`/v1/brands/${brand.id}`, { method: "PATCH", body: { name } })
      setEditing(false)
      setError(null)
      onSaved()
    } catch (err) {
      setError(asApiError(err))
    }
  }

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <div>
            <Input
              aria-label={`Rename ${brand.name}`}
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save()
                if (e.key === "Escape") setEditing(false)
              }}
              hasError={Boolean(error)}
            />
            {error && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error.message}</p>}
          </div>
        ) : (
          <span className="font-medium text-gray-900 dark:text-gray-50">{brand.name}</span>
        )}
      </TableCell>
      <TableCell className="text-gray-500">{brand.slug}</TableCell>
      {canWrite && (
        <TableCell className="text-right">
          {editing ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Rename
              </Button>
              <Button variant="ghost" onClick={() => onArchive(brand)}>
                Archive
              </Button>
            </div>
          )}
        </TableCell>
      )}
    </TableRow>
  )
}

function ArchiveDialog({ brand, onClose, onDone }: { brand: Brand | null; onClose: () => void; onDone: () => void }) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  async function archive() {
    if (!brand) return
    setBusy(true)
    try {
      await api(`/v1/brands/${brand.id}`, { method: "DELETE" })
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={brand !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Archive ${brand?.name ?? ""}?`}
      description="Products keep this brand. The name stays reserved: a new brand cannot reuse it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" isLoading={busy} onClick={archive}>
            Archive
          </Button>
        </>
      }
    >
      <ErrorNotice error={error} />
    </Dialog>
  )
}
