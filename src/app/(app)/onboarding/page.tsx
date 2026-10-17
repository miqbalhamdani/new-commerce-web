"use client"

import { CheckCircle2 } from "lucide-react"
import { useState } from "react"

import { ButtonLink } from "@/components/ui/common/ButtonLink"
import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { Stepper } from "@/components/ui/common/Stepper"
import {
  BrandsStep,
  CategoriesStep,
  ProductStep,
} from "@/components/ui/onboarding/Steps"
import { SettingsForm } from "@/components/ui/settings/SettingsForm"
import type { BrandPage, Category, Product, Settings } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"

// P1-068: the owner's first steps -- shop settings, brands, the category tree
// and a first product -- with sensible defaults already filled in (BR-029).
// Steps 2-4 write the shop's real brands, categories and products, the same
// ones the Catalog pages in the sidebar show.

const steps = ["Your shop", "Brands", "Categories", "First product"] as const
const DONE = steps.length

export default function OnboardingPage() {
  const canSettings = useCan("settings:write")
  const [step, setStep] = useState(0)
  const [product, setProduct] = useState<{
    product: Product
    priced: boolean
  } | null>(null)
  const { data: settings, setData } = useResource<Settings>(
    canSettings ? "/v1/settings" : null,
  )

  if (!canSettings)
    return (
      <Page title="Get started">
        <Empty title="Only the shop's owner sets it up." />
      </Page>
    )
  if (!settings) return <Loading />

  return (
    <Page
      title="Get started"
      description="Four short steps. Everything you add here also shows up under Catalog in the sidebar."
    >
      <Stepper steps={steps} current={step} />
      <Card className="p-6">
        {step === 0 && (
          <SettingsForm
            settings={settings}
            canSave
            submitLabel="Continue"
            onSaved={(s) => {
              setData(s)
              setStep(1)
            }}
          />
        )}
        {step === 1 && (
          <BrandsStep
            shopName={settings.name}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <CategoriesStep onBack={() => setStep(1)} onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <ProductStep
            onBack={() => setStep(2)}
            onSkip={() => setStep(DONE)}
            onCreated={(p, priced) => {
              setProduct({ product: p, priced })
              setStep(DONE)
            }}
          />
        )}
        {step === DONE && <Done created={product} onBack={() => setStep(3)} />}
      </Card>
    </Page>
  )
}

function Done({
  created,
  onBack,
}: {
  created: { product: Product; priced: boolean } | null
  onBack: () => void
}) {
  const { data: brands } = useResource<BrandPage>("/v1/brands?limit=200")
  const { data: categories } = useResource<{ data: Category[] }>(
    "/v1/categories?kind=category",
  )
  const brandCount = brands?.data.length ?? 0
  const categoryCount = categories?.data.length ?? 0
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-7 text-success-500" aria-hidden />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Your shop is set up
        </h2>
      </div>
      <ul className="flex flex-col gap-1 text-theme-sm text-gray-600 dark:text-gray-400">
        <li>
          {brandCount} {brandCount === 1 ? "brand" : "brands"} and{" "}
          {categoryCount} {categoryCount === 1 ? "category" : "categories"}, in
          Catalog › Brands and Catalog › Categories.
        </li>
        <li>
          {created
            ? `"${created.product.title}" is saved as a draft${created.priced ? "" : " with no price yet"}. Add a photo, a SKU and a weight to publish it.`
            : "No product yet."}
        </li>
      </ul>
      <div className="flex flex-wrap gap-2">
        {created ? (
          <ButtonLink href={`/products/${created.product.id}`}>
            Finish your product
          </ButtonLink>
        ) : (
          <ButtonLink href="/products/new">Add your first product</ButtonLink>
        )}
        <ButtonLink href="/products/import" variant="outline">
          Import a spreadsheet
        </ButtonLink>
        <ButtonLink href="/products" variant="outline">
          Go to products
        </ButtonLink>
      </div>
      {!created && (
        <button
          type="button"
          onClick={onBack}
          className="text-theme-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
        >
          Back to the product step
        </button>
      )}
    </div>
  )
}
