"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { NativeSelect } from "@/components/ui/common/Field"
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
  const [cursor, setCursor] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
  const { data, error, loading } = useResource<ProductPage>(
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
            <Button variant="secondary" asChild>
              <Link href="/products/import">Import CSV</Link>
            </Button>
            <Button onClick={() => setCreating(true)}>New product</Button>
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
        <NativeSelect
          aria-label="Status"
          value={filters.status}
          onChange={(e) =>
            update({ status: e.target.value as ProductFilters["status"] })
          }
        >
          <option value="">Draft and active</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Brand"
          value={filters.brand_id}
          onChange={(e) => update({ brand_id: e.target.value })}
        >
          <option value="">All brands</option>
          {brands?.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Category"
          value={filters.category_id}
          onChange={(e) => update({ category_id: e.target.value })}
        >
          <option value="">All categories</option>
          {categories?.data.map((c) => (
            <option key={c.id} value={c.id}>
              {"\u00a0\u00a0".repeat(c.path.split(".").length - 1)}
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Sort"
          value={filters.sort}
          onChange={(e) =>
            update({ sort: e.target.value as ProductFilters["sort"] })
          }
        >
          <option value="-created_at">Newest</option>
          <option value="-updated_at">Recently changed</option>
          <option value="title">Title</option>
        </NativeSelect>
      </div>

      <ErrorNotice error={error} title="Could not load products" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="No products match">
          Clear a filter, or add a product.
        </Empty>
      ) : data ? (
        <ProductTable rows={data.data} />
      ) : null}
      {data?.next_cursor && (
        <div className="mt-4 flex justify-end">
          <Button
            variant="secondary"
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={busy} disabled={!title.trim()}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
