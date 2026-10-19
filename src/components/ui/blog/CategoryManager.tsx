"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"

import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Checkbox, Field } from "@/components/ui/common/Field"
import { ApiError } from "@/lib/api/client"
import type { BlogCategory } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"
import { slugify } from "@/lib/catalog/slug"

/** What the dialog shows: the list, a form (null: adding), or a delete. */
type Mode =
  | { kind: "list" }
  | { kind: "form"; category: BlogCategory | null }
  | { kind: "delete"; category: BlogCategory }

/**
 * Blog categories, managed from the post editor (P1-606, 04-api-spec.md
 * §13.1, BR-130): add, rename, reorder by position, delete (archive). A
 * category added here is handed back so the post picks it.
 */
export function CategoryManager({
  open,
  categories,
  startAdding,
  onClose,
  onChanged,
  onCreated,
}: {
  open: boolean
  categories: BlogCategory[]
  /** Open straight on the add form. */
  startAdding?: boolean
  onClose: () => void
  onChanged: () => void
  onCreated: (c: BlogCategory) => void
}) {
  const [mode, setMode] = useState<Mode>(
    startAdding ? { kind: "form", category: null } : { kind: "list" },
  )
  const next = Math.max(0, ...categories.map((c) => c.position)) + 1
  const close = () => {
    setMode({ kind: "list" })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={
        mode.kind === "form"
          ? mode.category
            ? `Edit ${mode.category.name}`
            : "Add a category"
          : mode.kind === "delete"
            ? `Delete ${mode.category.name}?`
            : "Blog categories"
      }
      description={
        mode.kind === "delete"
          ? "Its posts stay, and show on your website with no category until you move them."
          : mode.kind === "list"
            ? "The tabs on your journal page, lowest order first. Your website shows tabs only when there are two or more."
            : undefined
      }
    >
      {mode.kind === "list" && (
        <div className="flex flex-col gap-4">
          {categories.length === 0 ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              No categories yet. A post&apos;s category is optional.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-white/[0.05]">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <span className="w-6 text-theme-xs text-gray-400">
                    {c.position}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                      {c.name}
                    </span>
                    <span className="block text-theme-xs text-gray-500">
                      {c.slug}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Edit ${c.name}`}
                    className="text-gray-400 hover:text-brand-500"
                    onClick={() => setMode({ kind: "form", category: c })}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${c.name}`}
                    className="text-gray-400 hover:text-error-500"
                    onClick={() => setMode({ kind: "delete", category: c })}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={close}>
              Done
            </Button>
            <Button
              size="sm"
              onClick={() => setMode({ kind: "form", category: null })}
            >
              Add category
            </Button>
          </div>
        </div>
      )}
      {mode.kind === "form" && (
        <CategoryForm
          key={mode.category?.id ?? "new"}
          category={mode.category}
          nextPosition={next}
          onBack={() => setMode({ kind: "list" })}
          onSaved={(c, created) => {
            onChanged()
            if (created) {
              onCreated(c)
              close()
            } else setMode({ kind: "list" })
          }}
        />
      )}
      {mode.kind === "delete" && (
        <DeleteCategory
          category={mode.category}
          onBack={() => setMode({ kind: "list" })}
          onDeleted={() => {
            onChanged()
            setMode({ kind: "list" })
          }}
        />
      )}
    </Dialog>
  )
}

/** The slug follows the name until "Edit slug" is ticked, as for brands (BR-030). */
function CategoryForm({
  category,
  nextPosition,
  onBack,
  onSaved,
}: {
  category: BlogCategory | null
  nextPosition: number
  onBack: () => void
  onSaved: (c: BlogCategory, created: boolean) => void
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
    e.stopPropagation() // the dialog sits inside the post's form
    setSaving(true)
    try {
      const saved = await api<BlogCategory>(
        category ? `/v1/blog/categories/${category.id}` : "/v1/blog/categories",
        {
          method: category ? "PATCH" : "POST",
          body: {
            name,
            position: Number(position),
            ...(customSlug ? { slug } : {}),
          },
        },
      )
      onSaved(saved, !category)
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
        <Button size="sm" type="button" variant="outline" onClick={onBack}>
          Back
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
  )
}

function DeleteCategory({
  category,
  onBack,
  onDeleted,
}: {
  category: BlogCategory
  onBack: () => void
  onDeleted: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  async function remove() {
    setBusy(true)
    try {
      await api(`/v1/blog/categories/${category.id}`, { method: "DELETE" })
      onDeleted()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <ErrorNotice error={error} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          size="sm"
          variant="destructive"
          isLoading={busy}
          onClick={remove}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
