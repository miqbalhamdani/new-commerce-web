"use client"

import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { StorefrontSettingsForm } from "@/components/ui/settings/StorefrontSettingsForm"
import type { StorefrontSettings } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"

// P1-217: storefront settings (04-api-spec.md §4). Owner, admin and viewer
// read them; only the owner saves (BR-025).

export default function StorefrontSettingsPage() {
  const canRead = useCan("settings:read")
  const canWrite = useCan("settings:write")
  const { data, setData, error, loading } = useResource<StorefrontSettings>(
    canRead ? "/v1/storefront-settings" : null,
  )

  if (!canRead)
    return (
      <Page title="Storefront">
        <Empty title="You don't have access to the storefront settings." />
      </Page>
    )
  return (
    <Page
      title="Storefront"
      description={
        canWrite
          ? "Your website's look, payments, shipping and sign-in."
          : "Only the shop's owner can change these."
      }
    >
      <ErrorNotice
        error={error}
        title="Could not load the storefront settings"
      />
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <div className="max-w-2xl">
          <StorefrontSettingsForm
            key={JSON.stringify(data)}
            settings={data}
            canSave={canWrite}
            onSaved={setData}
          />
        </div>
      ) : null}
    </Page>
  )
}
