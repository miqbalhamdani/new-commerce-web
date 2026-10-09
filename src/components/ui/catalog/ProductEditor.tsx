"use client"

import Link from "next/link"
import { useState } from "react"

import Badge from "@/components/ui/badge/Badge"
import Button from "@/components/ui/button/Button"
import { BulkPriceAdjust } from "@/components/ui/catalog/BulkPriceAdjust"
import { MediaManager } from "@/components/ui/catalog/MediaManager"
import {
  AttributesFields,
  OrganizationFields,
  ProductInfoFields,
  SaveError,
  useProductForm,
} from "@/components/ui/catalog/ProductDetails"
import { PublishBar } from "@/components/ui/catalog/PublishBar"
import { VariantMatrix } from "@/components/ui/catalog/VariantMatrix"
import { Page, Section } from "@/components/ui/common/Page"
import type { Product } from "@/lib/api/types"
import { useCan } from "@/lib/auth/session"
import type { Failure } from "@/lib/catalog/publish"

const statusColor = {
  draft: "light",
  active: "success",
  archived: "warning",
} as const

/**
 * The product editor (P1-034, P1-046, P1-048, P1-075): the product's own
 * content in the main column, status and organisation in a side panel, one
 * Save in the Status card for the product's fields. Images and variants save on
 * their own, so they wait until the product exists.
 */
export function ProductEditor({
  product,
  onSaved,
  onReload,
}: {
  /** null: a new product. */
  product: Product | null
  onSaved: (p: Product) => void
  /** After an image or the variants change the product. */
  onReload?: () => void
}) {
  const canWrite = useCan("products:write")
  const canVariants = useCan("variants:write")
  const canMedia = useCan("media:write")
  const form = useProductForm(product, onSaved)
  const [failures, setFailures] = useState<Failure[]>([])
  const archived = product?.status === "archived"
  const editable = canWrite && !archived
  const status = product?.status ?? "draft"

  return (
    <Page
      wide
      title={product ? product.title : "New product"}
      description={
        product
          ? `Version ${product.version} · ${product.variant_count} live variant${product.variant_count === 1 ? "" : "s"}`
          : "Add the details first; images and variants come next."
      }
    >
      <div className="flex flex-col gap-6">
        <SaveError form={form} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.78fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <Section
              id="details"
              title="Product info"
              description="What customers see first: the name, its web address and the story."
            >
              {/* Only this card is the <form>, so Enter in a field saves;
                  the side panel's fields share its state and the Status
                  card's Save submits it. */}
              <form id="product-form" onSubmit={form.save}>
                <ProductInfoFields form={form} canWrite={editable} />
              </form>
            </Section>
            <Section
              id="images"
              title="Images"
              description="The first image is the cover. Drag to reorder."
            >
              {product ? (
                <MediaManager
                  product={product}
                  canWrite={canMedia && !archived}
                  onChanged={() => onReload?.()}
                />
              ) : (
                <NotYet>Create the product to add images.</NotYet>
              )}
            </Section>
            <Section
              id="variants"
              title="Variants"
              description="Each combination of options is a variant with its own SKU, price and weight."
            >
              {product ? (
                <VariantMatrix
                  product={product}
                  canWrite={canVariants && !archived}
                  onSaved={() => onReload?.()}
                  highlight={
                    new Map(
                      failures
                        .filter((f) => f.variantId)
                        .map((f) => [f.variantId!, f.detail]),
                    )
                  }
                >
                  {(grid) =>
                    canVariants && !archived && <BulkPriceAdjust {...grid} />
                  }
                </VariantMatrix>
              ) : (
                <NotYet>Create the product to add variants.</NotYet>
              )}
            </Section>
          </div>

          <aside
            aria-label="Status and organisation"
            className="flex flex-col gap-6 xl:self-start"
          >
            <Section
              title="Status"
              description="Drafts stay off your storefront until published."
            >
              <div className="flex flex-col gap-3">
                <div>
                  <Badge size="sm" color={statusColor[status]}>
                    {status}
                  </Badge>
                </div>
                {!product ? (
                  <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                    A new product starts as a draft. Publish it once it has a
                    variant, an image and a main-tree category.
                  </p>
                ) : archived ? (
                  <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                    Archived products are read-only.
                  </p>
                ) : (
                  canWrite && (
                    <PublishBar
                      product={product}
                      onChanged={onSaved}
                      onFailures={setFailures}
                    />
                  )
                )}
              </div>
              <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-white/[0.05]">
                {editable && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!form.dirty}
                      onClick={form.discard}
                    >
                      Discard changes
                    </Button>
                    <Button
                      size="sm"
                      type="submit"
                      form="product-form"
                      isLoading={form.saving}
                      disabled={!form.canSave}
                    >
                      {product ? "Save" : "Create product"}
                    </Button>
                  </div>
                )}
                <Link
                  href="/products"
                  className="self-center text-theme-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
                  onClick={(e) => {
                    if (
                      form.dirty &&
                      !confirm("Leave without saving your changes?")
                    )
                      e.preventDefault()
                  }}
                >
                  Back to products
                </Link>
              </div>
            </Section>
            <Section
              title="Organization"
              description="Brand and categories keep the catalog searchable."
            >
              <OrganizationFields form={form} canWrite={editable} />
            </Section>
            <Section
              title="Attributes"
              description="Free-form details such as material, fit or care."
            >
              <AttributesFields form={form} canWrite={editable} />
            </Section>
          </aside>
        </div>
      </div>
    </Page>
  )
}

function NotYet({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-theme-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
      {children}
    </p>
  )
}
