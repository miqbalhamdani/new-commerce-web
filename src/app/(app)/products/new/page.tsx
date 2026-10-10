"use client"

import { useRouter } from "next/navigation"

import { ProductEditor } from "@/components/ui/catalog/ProductEditor"

// A new product: details first. Creating lands on the editor, where images
// and variants are added (BR-037: it starts as a draft).

export default function NewProductPage() {
  const router = useRouter()
  return (
    <ProductEditor
      product={null}
      onSaved={(p) => router.replace(`/products/${p.id}`)}
    />
  )
}
