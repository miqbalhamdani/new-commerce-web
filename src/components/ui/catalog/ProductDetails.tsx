"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field, NativeSelect, Textarea } from "@/components/ui/common/Field"
import { Card } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { BrandPage, Category, Product } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { draftOf, patchOf, type ProductDraft } from "@/lib/catalog/product-form"

const kindLabel: Record<string, string> = {
  category: "Category (main tree)",
  series: "Series",
  collection: "Collection",
  activity: "Activity",
  custom: "Custom",
}

/**
 * The product's own fields (P1-034, 04-api-spec.md §7.1). Saves only what
 * changed, at the version it read (BR-010); prompts before leaving with
 * unsaved changes; warns that editing the slug breaks old links (BR-042).
 */
export function ProductDetails({
  product,
  canWrite,
  onSaved,
  onDirtyChange,
}: {
  product: Product
  canWrite: boolean
  onSaved: (p: Product) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const api = useApi()
  // The form re-seeds only when the product itself changed version. An image
  // uploading or a variant saving reloads the product too, and must not wipe
  // what someone is typing (P1-048: uploading never blocks the form).
  const [base, setBase] = useState(product)
  const [draft, setDraft] = useState<ProductDraft>(() => draftOf(product))
  if (product.id !== base.id || product.version !== base.version) {
    setBase(product)
    setDraft(draftOf(product))
  }
  const original = useMemo(() => draftOf(base), [base])
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const { data: brands } = useResource<BrandPage>("/v1/brands?limit=200")
  const { data: categories } = useResource<{ data: Category[] }>(
    "/v1/categories",
  )
  const patch = patchOf(original, draft)
  const dirty = Object.keys(patch).length > 0

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const set = (p: Partial<ProductDraft>) => setDraft((d) => ({ ...d, ...p }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await api<Product>(`/v1/products/${product.id}`, {
        method: "PATCH",
        body: patch,
        headers: { "If-Match": String(product.version) },
      })
      setError(null)
      onSaved(saved)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const byKind = new Map<string, Category[]>()
  for (const c of categories?.data ?? [])
    byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c])

  return (
    <Card className="p-6">
      <form onSubmit={save} className="flex flex-col gap-5">
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
              draft.slug !== original.slug
                ? undefined
                : "The product's address on your website. Changing the title never changes it."
            }
          >
            <Input
              id="slug"
              value={draft.slug}
              onChange={(e) => set({ slug: e.target.value })}
            />
            {draft.slug !== original.slug && (
              <p
                role="alert"
                className="text-xs text-amber-700 dark:text-amber-400"
              >
                Links to /products/{original.slug} will stop working once you
                save.
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
              rows={4}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <Field id="brand" label="Brand" error={fieldError(error, "brand_id")}>
            <NativeSelect
              id="brand"
              value={draft.brand_id}
              onChange={(e) => set({ brand_id: e.target.value })}
            >
              <option value="">No brand</option>
              {brands?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div id="categories" tabIndex={-1}>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Categories
            </p>
            <p className="text-xs text-gray-500">
              A product can sit in several trees. It needs at least one
              main-tree category to be published.
            </p>
            {fieldError(error, "category_ids") && (
              <p className="text-xs text-red-700">
                {fieldError(error, "category_ids")}
              </p>
            )}
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {[...byKind.entries()].map(([kind, list]) => (
                <fieldset
                  key={kind}
                  className="rounded border border-gray-200 p-3 dark:border-gray-800"
                >
                  <legend className="px-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                    {kindLabel[kind] ?? kind}
                  </legend>
                  {list.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 py-0.5 text-sm"
                      style={{
                        paddingLeft: (c.path.split(".").length - 1) * 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draft.category_ids.includes(c.id)}
                        onChange={(e) =>
                          set({
                            category_ids: e.target.checked
                              ? [...draft.category_ids, c.id]
                              : draft.category_ids.filter((x) => x !== c.id),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Attributes
            </p>
            <p className="text-xs text-gray-500">
              Free-form details such as material, fit or care.
            </p>
            <div className="mt-2 flex flex-col gap-2">
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
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      set({
                        attributes: draft.attributes.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {canWrite && (
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start"
                  onClick={() =>
                    set({ attributes: [...draft.attributes, ["", ""]] })
                  }
                >
                  Add attribute
                </Button>
              )}
            </div>
          </div>
        </fieldset>

        {error?.code === "version_conflict" ? (
          <div
            role="alert"
            className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
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
        ) : (
          error &&
          !error.problem.errors?.length && (
            <ErrorNotice error={error} title="Could not save" />
          )
        )}
        {canWrite && (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!dirty}
              onClick={() => setDraft(original)}
            >
              Discard changes
            </Button>
            <Button type="submit" isLoading={saving} disabled={!dirty}>
              Save
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}
