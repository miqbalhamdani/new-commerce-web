"use client"

import { X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field, Textarea } from "@/components/ui/common/Field"
import { MultiSelect, Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { BrandPage, Category, Product } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import {
  createBodyOf,
  draftOf,
  emptyDraft,
  patchOf,
  type ProductDraft,
} from "@/lib/catalog/product-form"
import { slugify } from "@/lib/catalog/slug"
import { inTreeOrder } from "@/lib/catalog/tree"

const kindLabel: Record<string, string> = {
  category: "Category (main tree)",
  series: "Series",
  collection: "Collection",
  activity: "Activity",
  custom: "Custom",
}

export type ProductForm = ReturnType<typeof useProductForm>

/**
 * The product's own fields (P1-034, 04-api-spec.md §7.1), as state the editor
 * lays out across its columns. Saves only what changed, at the version it read
 * (BR-010); prompts before leaving with unsaved changes. With product null it
 * is the new-product form: save POSTs what was filled in.
 */
export function useProductForm(
  product: Product | null,
  onSaved: (p: Product) => void,
) {
  const api = useApi()
  // The form re-seeds only when the product itself changed version. An image
  // uploading or a variant saving reloads the product too, and must not wipe
  // what someone is typing (P1-048: uploading never blocks the form).
  const [base, setBase] = useState(product)
  const [draft, setDraft] = useState<ProductDraft>(() =>
    product ? draftOf(product) : emptyDraft(),
  )
  if (
    product &&
    (product.id !== base?.id || product.version !== base.version)
  ) {
    setBase(product)
    setDraft(draftOf(product))
  }
  const original = useMemo(() => (base ? draftOf(base) : emptyDraft()), [base])
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const { data: brands } = useResource<BrandPage>("/v1/brands?limit=200")
  const { data: categories } = useResource<{ data: Category[] }>(
    "/v1/categories",
  )
  const patch = patchOf(original, draft)
  const dirty = Object.keys(patch).length > 0

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const set = (p: Partial<ProductDraft>) => setDraft((d) => ({ ...d, ...p }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!dirty || !draft.title.trim()) return
    setSaving(true)
    try {
      const saved = product
        ? await api<Product>(`/v1/products/${product.id}`, {
            method: "PATCH",
            body: patch,
            headers: { "If-Match": String(product.version) },
          })
        : await api<Product>("/v1/products", {
            method: "POST",
            body: createBodyOf(draft),
          })
      setError(null)
      onSaved(saved)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return {
    product,
    draft,
    set,
    original,
    dirty,
    canSave: dirty && draft.title.trim() !== "",
    error,
    saving,
    save,
    discard: () => setDraft(original),
    brands: brands?.data ?? [],
    categories: categories?.data ?? [],
  }
}

/** Title, slug and description; warns that editing the slug breaks old links (BR-042). */
export function ProductInfoFields({
  form,
  canWrite,
}: {
  form: ProductForm
  canWrite: boolean
}) {
  const { product, draft, set, original, error } = form
  return (
    <fieldset disabled={!canWrite} className="flex flex-col gap-5">
      <Field id="title" label="Title" error={fieldError(error, "title")}>
        <Input
          id="title"
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>
      <Field
        id="slug"
        label="Slug"
        error={fieldError(error, "slug")}
        hint={
          !product
            ? "Generated from the title. You can change it after creating."
            : draft.slug !== original.slug
              ? undefined
              : "The product's address on your website. Changing the title never changes it."
        }
      >
        <Input
          id="slug"
          value={product ? draft.slug : slugify(draft.title)}
          readOnly={!product}
          className={product ? "" : "!bg-gray-50 dark:!bg-white/[0.03]"}
          onChange={(e) => set({ slug: e.target.value })}
        />
        {product && draft.slug !== original.slug && (
          <p
            role="alert"
            className="text-xs text-warning-600 dark:text-orange-400"
          >
            Links to /products/{original.slug} will stop working once you save.
          </p>
        )}
      </Field>
      <Field
        id="description"
        label="Description"
        error={fieldError(error, "description")}
      >
        <Textarea
          id="description"
          rows={5}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
    </fieldset>
  )
}

/** Brand and the categories from every tree (BR-031). */
export function OrganizationFields({
  form,
  canWrite,
}: {
  form: ProductForm
  canWrite: boolean
}) {
  const { draft, set, error, brands, categories } = form
  const byKind = new Map<string, Category[]>()
  for (const c of categories)
    byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c])

  return (
    <fieldset disabled={!canWrite} className="flex flex-col gap-5">
      <Field id="brand" label="Brand" error={fieldError(error, "brand_id")}>
        <Select
          id="brand"
          className="w-full"
          value={draft.brand_id}
          onChange={(v) => set({ brand_id: v })}
          options={[
            { value: "", label: "No brand" },
            ...brands.map((b) => ({ value: b.id, label: b.name })),
          ]}
          error={Boolean(fieldError(error, "brand_id"))}
        />
      </Field>
      <div id="categories" tabIndex={-1}>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-400">
          Categories
        </p>
        <p className="text-xs text-gray-500">
          It needs at least one main-tree category to be published.
        </p>
        {fieldError(error, "category_ids") && (
          <p className="text-xs text-error-500">
            {fieldError(error, "category_ids")}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-4">
          {[...byKind.entries()].map(([kind, list]) => {
            const ids = new Set(list.map((c) => c.id))
            return (
              <Field
                key={kind}
                id={`categories-${kind}`}
                label={kindLabel[kind] ?? kind}
              >
                <MultiSelect
                  id={`categories-${kind}`}
                  placeholder="None"
                  value={draft.category_ids.filter((x) => ids.has(x))}
                  onChange={(picked) =>
                    set({
                      category_ids: [
                        ...draft.category_ids.filter((x) => !ids.has(x)),
                        ...picked,
                      ],
                    })
                  }
                  options={inTreeOrder(list).map(({ category, depth }) => ({
                    value: category.id,
                    label: category.name,
                    depth,
                  }))}
                />
              </Field>
            )
          })}
        </div>
      </div>
    </fieldset>
  )
}

/** Free-form key/value details. */
export function AttributesFields({
  form,
  canWrite,
}: {
  form: ProductForm
  canWrite: boolean
}) {
  const { draft, set } = form
  return (
    <fieldset disabled={!canWrite} className="flex flex-col gap-2">
      {draft.attributes.map(([k, v], i) => (
        <div key={i} className="flex gap-2">
          <Input
            aria-label="Attribute"
            placeholder="material"
            value={k}
            onChange={(e) =>
              set({
                attributes: draft.attributes.map((a, j) =>
                  j === i ? [e.target.value, a[1]] : a,
                ),
              })
            }
          />
          <Input
            aria-label="Value"
            placeholder="Cotton combed 30s"
            value={v}
            onChange={(e) =>
              set({
                attributes: draft.attributes.map((a, j) =>
                  j === i ? [a[0], e.target.value] : a,
                ),
              })
            }
          />
          {canWrite && (
            <button
              type="button"
              aria-label={`Remove ${k || "attribute"}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              onClick={() =>
                set({ attributes: draft.attributes.filter((_, j) => j !== i) })
              }
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      ))}
      {canWrite && (
        <Button
          size="sm"
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => set({ attributes: [...draft.attributes, ["", ""]] })}
        >
          Add attribute
        </Button>
      )}
    </fieldset>
  )
}

/** A stale version (BR-010), or an error no field claims. */
export function SaveError({ form }: { form: ProductForm }) {
  const { error } = form
  if (error?.code === "version_conflict")
    return (
      <div
        role="alert"
        className="rounded-xl border border-warning-500 bg-warning-50 p-3 text-theme-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-orange-400"
      >
        Someone else changed this product while you were editing.{" "}
        <button
          type="button"
          className="font-medium underline"
          onClick={() => window.location.reload()}
        >
          Reload it
        </button>{" "}
        to see their changes; yours are not saved.
      </div>
    )
  if (error && !error.problem.errors?.length)
    return <ErrorNotice error={error} title="Could not save" />
  return null
}
