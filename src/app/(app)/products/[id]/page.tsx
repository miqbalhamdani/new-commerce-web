"use client"

import Link from "next/link"
import { use, useState } from "react"

import { Badge } from "@/components/Badge"
import { BulkPriceAdjust } from "@/components/ui/catalog/BulkPriceAdjust"
import { MediaManager } from "@/components/ui/catalog/MediaManager"
import { ProductDetails } from "@/components/ui/catalog/ProductDetails"
import { VariantMatrix } from "@/components/ui/catalog/VariantMatrix"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Loading, Page } from "@/components/ui/common/Page"
import type { Product } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"

// The product editor: details (P1-034), variants (P1-046), images (P1-048),
// publishing (P1-075).

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const canWrite = useCan("products:write")
  const canVariants = useCan("variants:write")
  const canMedia = useCan("media:write")
  const {
    data: product,
    setData,
    error,
    loading,
    reload,
  } = useResource<Product>(`/v1/products/${id}`)
  const [dirty, setDirty] = useState(false)

  if (loading && !product) return <Loading />
  if (!product)
    return (
      <div className="p-8">
        <ErrorNotice error={error} title="Could not load the product" />
      </div>
    )

  const archived = product.status === "archived"
  return (
    <Page
      wide
      title={product.title}
      description={`Version ${product.version} · ${product.variant_count} live variant${product.variant_count === 1 ? "" : "s"}`}
      actions={
        <>
          <Badge
            variant={
              product.status === "active"
                ? "success"
                : archived
                  ? "warning"
                  : "neutral"
            }
          >
            {product.status}
          </Badge>
          <Link
            href="/products"
            className="text-sm text-gray-600 hover:underline dark:text-gray-400"
            onClick={(e) => {
              if (dirty && !confirm("Leave without saving your changes?"))
                e.preventDefault()
            }}
          >
            Back to products
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="details">
          <h2
            id="details"
            className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50"
          >
            Details
          </h2>
          <ProductDetails
            product={product}
            canWrite={canWrite && !archived}
            onSaved={setData}
            onDirtyChange={setDirty}
          />
        </section>
        <section aria-labelledby="images">
          <h2
            id="images"
            className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50"
          >
            Images
          </h2>
          <MediaManager
            product={product}
            canWrite={canMedia && !archived}
            onChanged={reload}
          />
        </section>
        <section aria-labelledby="variants">
          <h2
            id="variants"
            className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50"
          >
            Variants
          </h2>
          <VariantMatrix
            product={product}
            canWrite={canVariants && !archived}
            onSaved={reload}
          >
            {(grid) =>
              canVariants && !archived && <BulkPriceAdjust {...grid} />
            }
          </VariantMatrix>
        </section>
      </div>
    </Page>
  )
}
