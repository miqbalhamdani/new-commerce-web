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
import { RowMenu } from "@/components/ui/common/RowMenu"
import { PencilIcon, TrashBinIcon } from "@/icons"
import { ApiError } from "@/lib/api/client"
import type { BlogCategory, BlogCategoryList } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import { slugify } from "@/lib/catalog/slug"

// P1-606: blog categories (04-api-spec.md §13.1, BR-130). They are the tabs
// on the shop's journal page, in position order. Deleting archives (BR-012);
// a post keeps its category, and the website shows it with none.

/** null: closed; "new": adding; a BlogCategory: editing it. */
type Editing = BlogCategory | "new" | null

export default function BlogCategoriesPage() {
  const canWrite = useCan("blog:write")
  const { data, error, loading, reload } = useResource<BlogCategoryList>(
    "/v1/blog/categories",
  )
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<BlogCategory | null>(null)
  const next = data ? Math.max(0, ...data.data.map((c) => c.position)) + 1 : 1

  return (
    <Page
      title="Blog categories"
      description="The tabs on your journal page. Your website shows tabs only when there are two or more."
    >
      <div className="mb-4 flex justify-end">
        {canWrite && (
          <Button size="sm" onClick={() => setEditing("new")}>
            Add category
          </Button>
        )}
      </div>

      <ErrorNotice error={error} title="Could not load blog categories" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="No categories yet">
          {canWrite &&
            "A post's category is optional; add one when you need tabs."}
        </Empty>
      ) : data ? (
        <ListTable>
          <TableHeader className={headerRow}>
            <TableRow>
              <TableCell isHeader className={`${th} w-px`}>
                Order
              </TableCell>
              <TableCell isHeader className={th}>
                Name
              </TableCell>
              <TableCell isHeader className={th}>
                Slug
              </TableCell>
              {canWrite && (
                <TableCell isHeader className={`${th} w-px`}>
                  <span className="sr-only">Actions</span>
                </TableCell>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className={bodyRows}>
            {data.data.map((c) => (
              <TableRow
                key={c.id}
                onClick={canWrite ? () => setEditing(c) : undefined}
                className={
                  canWrite
                    ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    : undefined
                }
              >
                <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                  {c.position}
                </TableCell>
                <TableCell className={td}>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    {c.name}
                  </span>
                </TableCell>
                <TableCell className={`${td} text-gray-500 dark:text-gray-400`}>
                  {c.slug}
                </TableCell>
                {canWrite && (
                  <TableCell className={`${td} !py-2 text-right`}>
                    <RowMenu
                      label={`Actions for ${c.name}`}
                      actions={[
                        {
                          label: "Edit",
                          icon: <PencilIcon />,
                          onSelect: () => setEditing(c),
                        },
                        {
                          label: "Delete",
                          icon: <TrashBinIcon />,
                          destructive: true,
                          onSelect: () => setDeleting(c),
                        },
                      ]}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      ) : null}

      {editing !== null && (
        <CategoryDialog
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          nextPosition={next}
          onClose={() => setEditing(null)}
          onDone={reload}
        />
      )}
      <DeleteDialog
        category={deleting}
        onClose={() => setDeleting(null)}
        onDone={reload}
      />
    </Page>
  )
}

/**
 * Add or edit. The slug follows the name until "Edit slug" is ticked, as for
 * brands (BR-030, BR-130). A new category goes last.
 */
function CategoryDialog({
  category,
  nextPosition,
  onClose,
  onDone,
}: {
  category: BlogCategory | null
  nextPosition: number
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [name, setName] = useState(category?.name ?? "")
  const [position, setPosition] = useState(
    String(category?.position ?? nextPosition),
  )
  const [customSlug, setCustomSlug] = useState(
    category ? category.slug !== slugify(category.name) : false,
  )
  const [slug, setSlug] = useState(category?.slug ?? "")
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const shownSlug = customSlug ? slug : slugify(name)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        name,
        position: Number(position),
        ...(customSlug ? { slug } : {}),
      }
      await api(
        category ? `/v1/blog/categories/${category.id}` : "/v1/blog/categories",
        { method: category ? "PATCH" : "POST", body },
      )
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
  const positionError = fieldError(error, "position")
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={category ? `Edit ${category.name}` : "Add a category"}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field id="blog-category-name" label="Name" error={nameError}>
          <Input
            id="blog-category-name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            error={Boolean(nameError)}
          />
        </Field>
        <Field
          id="blog-category-slug"
          label="Slug"
          error={slugError}
          hint={
            customSlug
              ? "Lower-case letters and digits joined by hyphens."
              : "Generated from the name."
          }
        >
          <Input
            id="blog-category-slug"
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
              if (e.target.checked) setSlug(shownSlug)
              setCustomSlug(e.target.checked)
            }}
          />
          Edit slug
        </label>
        <Field
          id="blog-category-position"
          label="Order"
          error={positionError}
          hint="Tabs show lowest first."
        >
          <Input
            id="blog-category-position"
            type="number"
            min="0"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            error={Boolean(positionError)}
          />
        </Field>
        {error && !nameError && !slugError && !positionError && (
          <ErrorNotice error={error} />
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            isLoading={saving}
            disabled={
              !name.trim() ||
              (customSlug && !slug.trim()) ||
              !/^\d+$/.test(position)
            }
          >
            {category ? "Save" : "Add category"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function DeleteDialog({
  category,
  onClose,
  onDone,
}: {
  category: BlogCategory | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  async function remove() {
    if (!category) return
    setBusy(true)
    try {
      await api(`/v1/blog/categories/${category.id}`, { method: "DELETE" })
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
      open={category !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`Delete ${category?.name ?? ""}?`}
      description="Its posts stay, and show on your website with no category until you move them."
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
