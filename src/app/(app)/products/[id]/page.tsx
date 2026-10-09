"use client"

import { use } from "react"

import { ProductEditor } from "@/components/ui/catalog/ProductEditor"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Loading } from "@/components/ui/common/Page"
import type { Product } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"

// The product editor: details (P1-034), variants (P1-046), images (P1-048),
// publishing (P1-075).

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const {
    data: product,
    setData,
    error,
    loading,
    reload,
  } = useResource<Product>(`/v1/products/${id}`)

  if (loading && !product) return <Loading />
  if (!product)
    return (
      <div className="p-8">
        <ErrorNotice error={error} title="Could not load the product" />
      </div>
    )
  return <ProductEditor product={product} onSaved={setData} onReload={reload} />
}
