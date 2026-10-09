"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox, Field } from "@/components/ui/common/Field"
import {
  bodyRows,
  headerRow,
  ListTable,
  td,
  th,
} from "@/components/ui/common/Listing"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { ApiError } from "@/lib/api/client"
import type { Brand, BrandPage } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import { slugify } from "@/lib/catalog/slug"

// P1-031: brands (01-product-requirements.md §4, 04-api-spec.md §6.1).
// Deleting is the API's soft delete (archived_at, BR-012); deleted brands are
// not shown anywhere here.

/** null: closed; "new": adding; a Brand: editing it. */
type Editing = Brand | "new" | null

export default function BrandsPage() {
  const canWrite = useCan("brands:write")
  const [q, setQ] = useState("")
  const [cursor, setCursor] = useState<string | null>(null)
  const params = new URLSearchParams({ limit: "50" })
  if (q.trim()) params.set("q", q.trim())
  if (cursor) params.set("cursor", cursor)
  const { data, error, loading, reload } = useResource<BrandPage>(
    `/v1/brands?${params}`,
  )

  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Brand | null>(null)

  return (
    <Page
      title="Brands"
      description="The labels your products are sold under."
      actions={
        canWrite && (
          <Button size="sm" onClick={() => setEditing("new")}>
            Add brand
          </Button>
        )
      }
    >
      <div className="mb-4">
        <SearchInput
          aria-label="Search brands"
          placeholder="Search brands"
          className="w-full max-w-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setCursor(null)
          }}
        />
      </div>

      <ErrorNotice error={error} title="Could not load brands" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="No brands yet">
          {canWrite && "Use Add brand. A product's brand is optional."}
        </Empty>
      ) : data ? (
        <ListTable>
          <TableHeader className={headerRow}>
            <TableRow>
              <TableCell isHeader className={th}>
                Name
              </TableCell>
              <TableCell isHeader className={th}>
                Slug
              </TableCell>
              {canWrite && (
                <TableCell isHeader className={`${th} text-right`}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className={bodyRows}>
            {data.data.map((b) => (
              <TableRow key={b.id}>
                <TableCell className={td}>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    {b.name}
                  </span>
                </TableCell>
                <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                  {b.slug}
                </TableCell>
                {canWrite && (
                  <TableCell className={`${td} text-right`}>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        className="!py-1.5"
                        variant="ghost"
                        onClick={() => setEditing(b)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        className="!py-1.5"
                        variant="ghost"
                        onClick={() => setDeleting(b)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      ) : null}
      {data?.next_cursor && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCursor(data.next_cursor)}
          >
            Next page
          </Button>
        </div>
      )}

      {editing !== null && (
        <BrandDialog
          key={editing === "new" ? "new" : editing.id}
          brand={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={reload}
        />
      )}
      <DeleteDialog
        brand={deleting}
        onClose={() => setDeleting(null)}
        onDone={reload}
      />
    </Page>
  )
}

/**
 * Add or edit. The slug follows the name until "Edit slug" is ticked; then it
 * is sent as typed (BR-030). Editing a brand whose slug was already customised
 * starts ticked, so saving does not overwrite it.
 */
function BrandDialog({
  brand,
  onClose,
  onDone,
}: {
  brand: Brand | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [name, setName] = useState(brand?.name ?? "")
  const [customSlug, setCustomSlug] = useState(
    brand ? brand.slug !== slugify(brand.name) : false,
  )
  const [slug, setSlug] = useState(brand?.slug ?? "")
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const shownSlug = customSlug ? slug : slugify(name)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = customSlug ? { name, slug } : { name }
      await api(brand ? `/v1/brands/${brand.id}` : "/v1/brands", {
        method: brand ? "PATCH" : "POST",
        body,
      })
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const nameError = fieldError(error, "name")
  const slugError = fieldError(error, "slug")
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={brand ? `Edit ${brand.name}` : "Add a brand"}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field id="brand-name" label="Name" error={nameError}>
          <Input
            id="brand-name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            error={Boolean(nameError)}
          />
        </Field>
        <Field
          id="brand-slug"
          label="Slug"
          error={slugError}
          hint={
            customSlug
              ? "Lower-case letters and digits joined by hyphens."
              : "Generated from the name."
          }
        >
          <Input
            id="brand-slug"
            value={shownSlug}
            readOnly={!customSlug}
            className={customSlug ? "" : "!bg-gray-50 dark:!bg-white/[0.03]"}
            onChange={(e) => setSlug(e.target.value)}
            error={Boolean(slugError)}
          />
        </Field>
        <label className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-400">
          <Checkbox
            checked={customSlug}
            onChange={(e) => {
              // Start editing from what was shown, not a stale value.
              if (e.target.checked) setSlug(shownSlug)
              setCustomSlug(e.target.checked)
            }}
          />
          Edit slug
        </label>
        {error && !nameError && !slugError && <ErrorNotice error={error} />}
        <div className="flex justify-end gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            isLoading={saving}
            disabled={!name.trim() || (customSlug && !slug.trim())}
          >
            {brand ? "Save" : "Add brand"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Deleting is never blocked; it takes the brand off its products (BR-012). */
function DeleteDialog({
  brand,
  onClose,
  onDone,
}: {
  brand: Brand | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  async function remove() {
    if (!brand) return
    setBusy(true)
    try {
      await api(`/v1/brands/${brand.id}`, { method: "DELETE" })
      setError(null)
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
      title={`Delete ${brand?.name ?? ""}?`}
      description="Products using this brand will have their brand cleared. This can't be undone."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            isLoading={busy}
            onClick={remove}
          >
            Delete
          </Button>
        </>
      }
    >
      <ErrorNotice error={error} />
    </Dialog>
  )
}
