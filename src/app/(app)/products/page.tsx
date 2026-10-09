"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { ButtonLink } from "@/components/ui/common/ButtonLink"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Select } from "@/components/ui/common/Select"
import { BulkActions } from "@/components/ui/catalog/BulkActions"
import { ProductTable } from "@/components/ui/catalog/ProductTable"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { BrandPage, Category, Product, ProductPage } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import {
  filtersFromQuery,
  filtersToQuery,
  rememberedFilters,
  rememberFilters,
  type ProductFilters,
} from "@/lib/catalog/filters"

// P1-033: the catalog list (04-api-spec.md §7.1).

export default function ProductsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<Loading />}>
      <ProductList />
    </Suspense>
  )
}

function ProductList() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filters = filtersFromQuery(params)
  const canWrite = useCan("products:write")
  const canSettings = useCan("settings:write")
  const [cursor, setCursor] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<Map<string, string>>(new Map())

  // Coming back to a bare /products restores the last filters used.
  useEffect(() => {
    if (params.toString() === "") {
      const saved = rememberedFilters()
      if (saved) router.replace(`${pathname}?${saved}`)
    } else {
      rememberFilters(params.toString())
    }
  }, [params, pathname, router])

  function update(next: Partial<ProductFilters>) {
    const q = filtersToQuery({ ...filters, ...next }).toString()
    rememberFilters(q)
    setCursor(null)
    router.replace(q ? `${pathname}?${q}` : pathname)
  }

  const query = filtersToQuery(filters)
  query.set("limit", "50")
  if (cursor) query.set("cursor", cursor)
  const { data, error, loading, reload } = useResource<ProductPage>(
    `/v1/products?${query}`,
  )
  const { data: brands } = useResource<BrandPage>("/v1/brands?limit=200")
  const { data: categories } = useResource<{ data: Category[] }>(
    "/v1/categories?kind=category",
  )

  return (
    <Page
      wide
      title="Products"
      description="Everything in your catalog."
      actions={
        canWrite && (
          <>
            <ButtonLink href="/products/import" variant="outline">
              Import CSV
            </ButtonLink>
            <Button size="sm" onClick={() => setCreating(true)}>
              New product
            </Button>
          </>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="Search by title or SKU"
          placeholder="Search by title or exact SKU"
          className="max-w-xs"
          defaultValue={filters.q}
          onKeyDown={(e) =>
            e.key === "Enter" && update({ q: e.currentTarget.value.trim() })
          }
          onBlur={(e) =>
            e.target.value.trim() !== filters.q &&
            update({ q: e.target.value.trim() })
          }
        />
        <Select
          aria-label="Status"
          value={filters.status}
          onChange={(v) => update({ status: v as ProductFilters["status"] })}
          options={[
            { value: "", label: "Draft and active" },
            { value: "draft", label: "Draft" },
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <Select
          aria-label="Brand"
          value={filters.brand_id}
          onChange={(v) => update({ brand_id: v })}
          options={[
            { value: "", label: "All brands" },
            ...(brands?.data.map((b) => ({ value: b.id, label: b.name })) ??
              []),
          ]}
        />
        <Select
          aria-label="Category"
          value={filters.category_id}
          onChange={(v) => update({ category_id: v })}
          options={[
            { value: "", label: "All categories" },
            ...(categories?.data.map((c) => ({
              value: c.id,
              label:
                "\u00a0\u00a0".repeat(c.path.split(".").length - 1) + c.name,
            })) ?? []),
          ]}
        />
        <Select
          aria-label="Sort"
          value={filters.sort}
          onChange={(v) => update({ sort: v as ProductFilters["sort"] })}
          options={[
            { value: "-created_at", label: "Newest" },
            { value: "-updated_at", label: "Recently changed" },
            { value: "title", label: "Title" },
          ]}
        />
      </div>

      <ErrorNotice error={error} title="Could not load products" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="No products match">
          Clear a filter, or add a product.
        </Empty>
      ) : data ? (
        <>
          {canWrite && selected.size > 0 && (
            <BulkActions
              selected={[...selected]}
              onDone={(f) => {
                setFailed(f)
                setSelected(new Set([...f.keys()]))
                reload()
              }}
            />
          )}
          <ProductTable
            rows={data.data}
            selectable={
              canWrite
                ? {
                    selected,
                    failed,
                    toggle: (id) => {
                      const s = new Set(selected)
                      if (s.has(id)) s.delete(id)
                      else s.add(id)
                      setSelected(s)
                    },
                  }
                : undefined
            }
          />
        </>
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
      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}

function CreateDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const api = useApi()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const p = await api<Product>("/v1/products", {
        method: "POST",
        body: { title },
      })
      router.push(`/products/${p.id}`)
    } catch (err) {
      setError(asApiError(err))
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="New product"
      description="It starts as a draft; publish it once it has variants, an image and a category."
    >
      <form onSubmit={create} className="flex flex-col gap-3">
        <Input
          aria-label="Title"
          placeholder="Erigo Basic Tee"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
        <ErrorNotice error={error} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" isLoading={busy} disabled={!title.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
