"use client"

import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

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
import { cx } from "@/lib/utils"
import type { Failure } from "@/lib/catalog/publish"

const statusLook = {
  draft: {
    label: "Draft",
    dot: "bg-gray-400",
    line: "Hidden from your storefront.",
  },
  active: {
    label: "Active",
    dot: "bg-success-500",
    line: "Live on your storefront.",
  },
  archived: {
    label: "Archived",
    dot: "bg-warning-500",
    line: "Off your storefront and read-only.",
  },
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
      back={
        <Link
          href="/products"
          aria-label="Back to products"
          className="inline-flex items-center gap-1 rounded text-theme-sm text-gray-500 hover:text-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:text-gray-400 dark:hover:text-brand-400"
          onClick={(e) => {
            if (form.dirty && !confirm("Leave without saving your changes?"))
              e.preventDefault()
          }}
        >
          <ChevronLeft aria-hidden className="size-4" />
          Products
        </Link>
      }
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
              description="The first image is the cover. Drag to reorder. Pick a variant under an image to show it when a shopper chooses that variant."
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
              title="Attributes"
              description="Free-form details such as material, fit or care."
            >
              <AttributesFields form={form} canWrite={editable} />
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
                  canMedia={canMedia && !archived}
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
            <Section title="Status">
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                  <span
                    aria-hidden
                    className={cx(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      statusLook[status].dot,
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      {statusLook[status].label}
                    </p>
                    <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
                      {product
                        ? statusLook[status].line
                        : "Starts as a draft. Publish once it has a variant, an image and a main-tree category."}
                    </p>
                  </div>
                </div>
                {product && editable && (
                  <PublishBar
                    product={product}
                    onChanged={onSaved}
                    onFailures={setFailures}
                  />
                )}
              </div>
              {editable && (
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5 dark:border-white/[0.05]">
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
            </Section>
            <Section
              title="Organization"
              description="Brand and categories keep the catalog searchable."
            >
              <OrganizationFields form={form} canWrite={editable} />
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
