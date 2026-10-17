"use client"

import { Boxes, FolderTree, Package, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field } from "@/components/ui/common/Field"
import { Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { BrandPage, Category, Product } from "@/lib/api/types"
import { asApiError, fieldError, useApi, useResource } from "@/lib/api/use-api"
import { firstProductRequests } from "@/lib/catalog/first-product"
import { inTreeOrder } from "@/lib/catalog/tree"
import { groupDigits } from "@/lib/format"

// P1-068: the wizard's brand, category and product steps. Each one says what
// the thing is, shows the shop's real list as it grows, and names the sidebar
// page it lives on -- the same data, so nothing here is a separate copy.

/** What this step is about, and where it lives afterwards (same icon as the sidebar). */
export function StepIntro({
  icon: Icon,
  title,
  href,
  page,
  children,
}: {
  icon: LucideIcon
  title: string
  href: string
  page: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6 flex gap-4 rounded-xl border border-brand-100 bg-brand-25 p-4 dark:border-brand-500/20 dark:bg-brand-500/[0.08]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 dark:text-brand-400">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h2>
        <p className="mt-0.5 text-theme-sm text-gray-600 dark:text-gray-400">
          {children}
        </p>
        <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
          Find it later in the sidebar: Catalog ›{" "}
          <Link
            href={href}
            className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            {page}
          </Link>
        </p>
      </div>
    </div>
  )
}

function Footer({
  onBack,
  onSkip,
  primary,
}: {
  onBack: () => void
  onSkip: () => void
  primary: React.ReactNode
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
      <Button size="sm" variant="outline" onClick={onBack}>
        Back
      </Button>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onSkip}>
          Skip
        </Button>
        {primary}
      </div>
    </div>
  )
}

function ListHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-6 text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </h3>
  )
}

function EmptyList({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center text-theme-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      {children}
    </p>
  )
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/** Step 2: the shop's brands, added one at a time (`POST /v1/brands`). */
export function BrandsStep({
  shopName,
  onBack,
  onNext,
}: {
  shopName: string
  onBack: () => void
  onNext: () => void
}) {
  const api = useApi()
  const { data, reload } = useResource<BrandPage>("/v1/brands?limit=200")
  const brands = data?.data ?? []
  const [typed, setTyped] = useState<string | null>(null)
  // A shop with no brand yet most often sells its own label first.
  const name = typed ?? (data && brands.length === 0 ? shopName : "")
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(): Promise<boolean> {
    setBusy(true)
    try {
      await api("/v1/brands", { method: "POST", body: { name: name.trim() } })
      setTyped("")
      setError(null)
      reload()
      return true
    } catch (err) {
      setError(asApiError(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  // Continue keeps what is typed, as the Add button would.
  async function next() {
    if (
      name.trim() &&
      !brands.some((b) => sameName(b.name, name)) &&
      !(await add())
    )
      return
    onNext()
  }

  return (
    <div>
      <StepIntro icon={Boxes} title="Brands" href="/brands" page="Brands">
        The name a product is sold under: your own label, or brands you resell
        like Nike. Each product has one brand, or none.
      </StepIntro>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) void add()
        }}
        className="flex items-start gap-2"
      >
        <div className="flex-1">
          <Field
            id="brand-name"
            label="Brand name"
            error={fieldError(error, "name")}
            hint="Add as many as you like. Rename or remove them later on the Brands page."
          >
            <Input
              id="brand-name"
              value={name}
              onChange={(e) => setTyped(e.target.value)}
              error={Boolean(fieldError(error, "name"))}
            />
          </Field>
        </div>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="mt-[26px]"
          disabled={!name.trim()}
          isLoading={busy}
        >
          + Add
        </Button>
      </form>
      {error && !fieldError(error, "name") && <ErrorNotice error={error} />}

      <ListHeading>Your brands ({brands.length})</ListHeading>
      {brands.length === 0 ? (
        <EmptyList>
          No brands yet. Add one, or skip: brands are optional.
        </EmptyList>
      ) : (
        <ul aria-label="Your brands" className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <li
              key={b.id}
              className="rounded-full border border-gray-200 px-3 py-1 text-theme-sm text-gray-700 dark:border-gray-800 dark:text-gray-300"
            >
              {b.name}
            </li>
          ))}
        </ul>
      )}

      <Footer
        onBack={onBack}
        onSkip={onNext}
        primary={
          <Button size="sm" onClick={() => void next()} disabled={busy}>
            Continue
          </Button>
        }
      />
    </div>
  )
}

const TOP = ""

/** Step 3: the main category tree, built by naming where each one goes. */
export function CategoriesStep({
  onBack,
  onNext,
}: {
  onBack: () => void
  onNext: () => void
}) {
  const api = useApi()
  const { data, reload } = useResource<{ data: Category[] }>(
    "/v1/categories?kind=category",
  )
  const ordered = inTreeOrder(data?.data ?? [])
  const [name, setName] = useState("")
  const [parent, setParent] = useState(TOP)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(): Promise<boolean> {
    setBusy(true)
    try {
      await api("/v1/categories", {
        method: "POST",
        body: {
          name: name.trim(),
          kind: "category",
          ...(parent !== TOP ? { parent_id: parent } : {}),
        },
      })
      // The parent stays put, so the next one lands beside this one.
      setName("")
      setError(null)
      reload()
      return true
    } catch (err) {
      setError(asApiError(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function next() {
    if (name.trim() && !(await add())) return
    onNext()
  }

  return (
    <div>
      <StepIntro
        icon={FolderTree}
        title="Categories"
        href="/categories"
        page="Categories"
      >
        The menu shoppers browse, like Apparel › Tees. A product needs a
        category before it can be published.
      </StepIntro>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) void add()
        }}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
      >
        <Field
          id="category-name"
          label="Category name"
          error={fieldError(error, "name")}
        >
          <Input
            id="category-name"
            value={name}
            placeholder={parent === TOP ? "e.g. Apparel" : "e.g. Tees"}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(fieldError(error, "name"))}
          />
        </Field>
        <Field
          id="category-parent"
          label="Put it inside"
          error={fieldError(error, "parent_id")}
          hint="Top level, or inside one you added."
        >
          <Select
            className="w-full"
            id="category-parent"
            value={parent}
            onChange={setParent}
            options={[
              { value: TOP, label: "Top level" },
              ...ordered.map(({ category, depth }) => ({
                value: category.id,
                label: category.name,
                depth,
              })),
            ]}
          />
        </Field>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="sm:mt-[26px]"
          disabled={!name.trim()}
          isLoading={busy}
        >
          + Add
        </Button>
      </form>
      {error &&
        !fieldError(error, "name") &&
        !fieldError(error, "parent_id") && <ErrorNotice error={error} />}

      <ListHeading>Your categories ({ordered.length})</ListHeading>
      {ordered.length === 0 ? (
        <EmptyList>
          Start with a top-level category like Apparel, then add categories
          inside it.
        </EmptyList>
      ) : (
        <ul
          aria-label="Your categories"
          className="flex flex-col gap-1 text-theme-sm text-gray-700 dark:text-gray-300"
        >
          {ordered.map(({ category, depth }) => (
            <li
              key={category.id}
              className="flex items-center gap-2"
              style={{ paddingLeft: `${depth * 1.25}rem` }}
            >
              <span
                aria-hidden
                className={
                  depth === 0
                    ? "size-1.5 rounded-full bg-brand-500"
                    : "h-px w-2.5 bg-gray-300 dark:bg-gray-700"
                }
              />
              <span className={depth === 0 ? "font-medium" : undefined}>
                {category.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Footer
        onBack={onBack}
        onSkip={onNext}
        primary={
          <Button size="sm" onClick={() => void next()} disabled={busy}>
            Continue
          </Button>
        }
      />
    </div>
  )
}

/** Step 4: a first product, saved as a draft with one price. */
export function ProductStep({
  onBack,
  onSkip,
  onCreated,
}: {
  onBack: () => void
  onSkip: () => void
  onCreated: (product: Product, priced: boolean) => void
}) {
  const api = useApi()
  const { data: brandPage } = useResource<BrandPage>("/v1/brands?limit=200")
  const { data: categoryList } = useResource<{ data: Category[] }>(
    "/v1/categories?kind=category",
  )
  const brands = brandPage?.data ?? []
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")
  const [brand, setBrand] = useState<string | null>(null)
  const [category, setCategory] = useState("")
  const [priceError, setPriceError] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  // Until the owner picks, the brand they just added is the likely one.
  const brandId = brand ?? brands[0]?.id ?? ""

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const {
      create,
      matrix,
      error: bad,
    } = firstProductRequests({
      title,
      price,
      brandId,
      categoryId: category,
    })
    setPriceError(bad)
    if (bad) return
    setBusy(true)
    try {
      const product = await api<Product>("/v1/products", {
        method: "POST",
        body: create,
      })
      let priced = !matrix
      if (matrix) {
        // The product exists now; a failed price is finished in the editor
        // rather than retried here, which would create the product twice.
        priced = await api(`/v1/products/${product.id}/variant-matrix`, {
          method: "PUT",
          body: matrix,
          headers: { "If-Match": String(product.version) },
        }).then(
          () => true,
          () => false,
        )
      }
      onCreated(product, priced)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={create}>
      <StepIntro
        icon={Package}
        title="First product"
        href="/products"
        page="Products"
      >
        Something you sell. Start with a name and a price; photos, sizes and
        colours come next in the product editor.
      </StepIntro>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="product-title"
          label="Product name"
          error={fieldError(error, "title")}
        >
          <Input
            id="product-title"
            value={title}
            placeholder="e.g. Basic Tee"
            onChange={(e) => setTitle(e.target.value)}
            error={Boolean(fieldError(error, "title"))}
            required
          />
        </Field>
        <Field
          id="product-price"
          label="Price"
          error={priceError ?? undefined}
          hint="Optional. In rupiah."
        >
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-gray-500 dark:text-gray-400"
            >
              Rp
            </span>
            <Input
              id="product-price"
              inputMode="numeric"
              value={price}
              placeholder="199,000"
              className="pl-11"
              onChange={(e) => setPrice(groupDigits(e.target.value))}
              error={Boolean(priceError)}
            />
          </div>
        </Field>
        <Field id="product-brand" label="Brand">
          <Select
            className="w-full"
            id="product-brand"
            value={brandId}
            onChange={setBrand}
            options={[
              { value: "", label: "No brand" },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Field>
        <Field id="product-category" label="Category">
          <Select
            className="w-full"
            id="product-category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "None yet" },
              ...inTreeOrder(categoryList?.data ?? []).map(
                ({ category: c, depth }) => ({
                  value: c.id,
                  label: c.name,
                  depth,
                }),
              ),
            ]}
          />
        </Field>
      </div>

      <p
        role="note"
        className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-theme-sm text-gray-600 dark:bg-white/[0.03] dark:text-gray-400"
      >
        Saved as a draft: shoppers see it once it has a photo, a SKU and a
        weight. You will add those in the product editor next.
      </p>
      {error && !fieldError(error, "title") && <ErrorNotice error={error} />}

      <Footer
        onBack={onBack}
        onSkip={onSkip}
        primary={
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim()}
            isLoading={busy}
          >
            Create product
          </Button>
        }
      />
    </form>
  )
}
