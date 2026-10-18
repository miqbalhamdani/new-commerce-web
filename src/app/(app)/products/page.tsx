"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import { ButtonLink } from "@/components/ui/common/ButtonLink"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { Select } from "@/components/ui/common/Select"
import { BulkActions } from "@/components/ui/catalog/BulkActions"
import { ProductTable } from "@/components/ui/catalog/ProductTable"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { Pager } from "@/components/ui/common/Pager"
import { ApiError } from "@/lib/api/client"
import type {
  BrandPage,
  Category,
  ProductListItem,
  ProductPage,
} from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"
import {
  filtersFromQuery,
  filtersToQuery,
  rememberedFilters,
  rememberFilters,
  type ProductFilters,
} from "@/lib/catalog/filters"
import { pageFromQuery, withPage } from "@/lib/pagination"

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
  const page = pageFromQuery(params)
  const canWrite = useCan("products:write")
  const canSettings = useCan("settings:write")
  const [archiving, setArchiving] = useState<ProductListItem | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<Map<string, string>>(new Map())

  // Coming back to a bare /products restores the last filters used.
  useEffect(() => {
    if (params.toString() === "") {
      const saved = rememberedFilters()
      if (saved) router.replace(`${pathname}?${saved}`)
    } else {
      rememberFilters(withPage(params, 1))
    }
  }, [params, pathname, router])

  function update(next: Partial<ProductFilters>) {
    const q = filtersToQuery({ ...filters, ...next }).toString()
    rememberFilters(q)
    router.replace(q ? `${pathname}?${q}` : pathname)
  }

  function goPage(n: number) {
    const q = withPage(params, n)
    router.replace(q ? `${pathname}?${q}` : pathname)
  }

  const query = filtersToQuery(filters)
  query.set("limit", "50")
  if (page > 1) query.set("page", String(page))
  const { data, error, loading, reload } = useResource<ProductPage>(
    `/v1/products?${query}`,
  )
  const { data: brands } = useResource<BrandPage>("/v1/brands?limit=200")
  const { data: categories } = useResource<{ data: Category[] }>(
    "/v1/categories?kind=category",
  )

  return (
    <Page wide title="Products" description="Everything in your catalog.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          aria-label="Search by title or SKU"
          placeholder="Search by title or exact SKU"
          className="w-full max-w-xs"
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
        {canWrite && (
          <div className="ml-auto flex gap-3">
            <ButtonLink href="/products/import" variant="outline">
              Import CSV
            </ButtonLink>
            <ButtonLink href="/products/new">New product</ButtonLink>
          </div>
        )}
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
            onArchive={canWrite ? setArchiving : undefined}
          />
        </>
      ) : null}
      <Pager
        className="mt-4"
        page={page}
        limit={50}
        total={data?.total}
        noun="products"
        onPage={goPage}
      />
      <ArchiveDialog
        product={archiving}
        onClose={() => setArchiving(null)}
        onDone={reload}
      />
    </Page>
  )
}

/** Archiving takes the product off the storefront for good (BR-012, BR-045). */
function ArchiveDialog({
  product,
  onClose,
  onDone,
}: {
  product: ProductListItem | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  function close() {
    setError(null)
    onClose()
  }
  async function archive() {
    if (!product) return
    setBusy(true)
    try {
      await api(`/v1/products/${product.id}`, { method: "DELETE" })
      close()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={product !== null}
      onOpenChange={(o) => !o && close()}
      title={`Archive ${product?.title ?? ""}?`}
      description="It leaves your storefront and can't be restored. Orders that include it keep it."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            isLoading={busy}
            onClick={archive}
          >
            Archive
          </Button>
        </>
      }
    >
      <ErrorNotice error={error} />
    </Dialog>
  )
}
