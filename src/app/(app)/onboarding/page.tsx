"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import Label from "@/components/form/Label"
import { ButtonLink } from "@/components/ui/common/ButtonLink"
import { SettingsForm } from "@/components/ui/settings/SettingsForm"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { ApiError } from "@/lib/api/client"
import type { Category, Settings } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"

// P1-068: the owner's first steps -- shop settings, a first brand, a first
// category tree -- with sensible defaults already filled in (BR-029).

const steps = ["Your shop", "First brand", "First categories"] as const

export default function OnboardingPage() {
  const canSettings = useCan("settings:write")
  const [step, setStep] = useState(0)
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
      description="Three short steps, then add your products."
    >
      <ol className="mb-6 flex flex-wrap items-center gap-3" aria-label="Steps">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className="flex items-center gap-3"
          >
            {i > 0 && (
              <span
                aria-hidden
                className="h-px w-8 bg-gray-200 dark:bg-gray-800"
              />
            )}
            <span className="flex items-center gap-2 text-theme-sm">
              <span
                className={
                  i < step
                    ? "flex size-8 items-center justify-center rounded-full bg-brand-500 text-white"
                    : i === step
                      ? "flex size-8 items-center justify-center rounded-full text-brand-500 ring-2 ring-inset ring-brand-500"
                      : "flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"
                }
              >
                {i + 1}
              </span>
              <span
                className={
                  i === step
                    ? "font-medium text-gray-800 dark:text-white/90"
                    : "text-gray-500 dark:text-gray-400"
                }
              >
                {s}
              </span>
            </span>
          </li>
        ))}
      </ol>
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
        {step === 1 && <FirstBrand onDone={() => setStep(2)} />}
        {step === 2 && <FirstCategories done={step > 2} />}
      </Card>
    </Page>
  )
}

function FirstBrand({ onDone }: { onDone: () => void }) {
  const api = useApi()
  const { data: settings } = useResource<Settings>("/v1/settings")
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const value = name ?? settings?.name ?? "" // most shops sell their own brand first
  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api("/v1/brands", { method: "POST", body: { name: value } })
      onDone()
    } catch (err) {
      const ae = asApiError(err)
      // A brand of that name already exists: nothing to add, move on.
      if (
        ae.problem.errors?.some((x) => x.field === "name") &&
        /already/.test(ae.message)
      )
        onDone()
      else setError(ae)
    }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <Label htmlFor="brand" className="mb-0">
        The brand you sell
      </Label>
      <Input
        id="brand"
        value={value}
        onChange={(e) => setName(e.target.value)}
      />
      <ErrorNotice error={error} />
      <div className="flex justify-between">
        <Button size="sm" type="button" variant="ghost" onClick={onDone}>
          Skip — not every product has a brand
        </Button>
        <Button size="sm" type="submit" disabled={!value.trim()}>
          Continue
        </Button>
      </div>
    </form>
  )
}

function FirstCategories({ done }: { done: boolean }) {
  const api = useApi()
  const [root, setRoot] = useState("Apparel")
  const [children, setChildren] = useState("Tees, Shirts, Outerwear")
  const [error, setError] = useState<ApiError | null>(null)
  const [finished, setFinished] = useState(done)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const top = await api<Category>("/v1/categories", {
        method: "POST",
        body: { name: root, kind: "category" },
      })
      for (const name of children
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        await api("/v1/categories", {
          method: "POST",
          body: { name, kind: "category", parent_id: top.id },
        })
      }
      setFinished(true)
    } catch (err) {
      setError(asApiError(err))
    }
  }
  if (finished) {
    return (
      <div className="flex flex-col gap-3 text-theme-sm text-gray-700 dark:text-gray-300">
        <p className="font-medium text-gray-800 dark:text-white/90">
          Your shop is set up.
        </p>
        <div className="flex gap-2">
          <ButtonLink href="/products">Add your first product</ButtonLink>
          <ButtonLink href="/products/import" variant="outline">
            Import a spreadsheet
          </ButtonLink>
        </div>
      </div>
    )
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <Label htmlFor="root" className="mb-0">
        Main category
      </Label>
      <Input id="root" value={root} onChange={(e) => setRoot(e.target.value)} />
      <Label htmlFor="children" className="mb-0">
        Under it (comma separated)
      </Label>
      <Input
        id="children"
        value={children}
        onChange={(e) => setChildren(e.target.value)}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        You can rearrange these any time by dragging them in Categories.
      </p>
      <ErrorNotice error={error} />
      <div className="flex justify-between">
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => setFinished(true)}
        >
          Skip
        </Button>
        <Button size="sm" type="submit" disabled={!root.trim()}>
          Finish
        </Button>
      </div>
    </form>
  )
}
