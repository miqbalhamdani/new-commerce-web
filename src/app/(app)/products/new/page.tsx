"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { ProductDetails } from "@/components/ui/catalog/ProductDetails"
import { Page } from "@/components/ui/common/Page"
import { useCan } from "@/lib/auth/session"

// A new product's details. Creating lands on the editor, where images and
// variants are added (BR-037: it starts as a draft).

export default function NewProductPage() {
  const router = useRouter()
  const canWrite = useCan("products:write")
  const [dirty, setDirty] = useState(false)

  return (
    <Page
      wide
      title="New product"
      description="It starts as a draft; publish it once it has variants, an image and a category."
      actions={
        <Link
          href="/products"
          className="text-theme-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
          onClick={(e) => {
            if (dirty && !confirm("Leave without saving your changes?"))
              e.preventDefault()
          }}
        >
          Back to products
        </Link>
      }
    >
      <ProductDetails
        product={null}
        canWrite={canWrite}
        onSaved={(p) => router.replace(`/products/${p.id}`)}
        onDirtyChange={setDirty}
      />
    </Page>
  )
}
