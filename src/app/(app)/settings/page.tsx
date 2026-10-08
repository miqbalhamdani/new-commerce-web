"use client"

import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { SettingsForm } from "@/components/ui/settings/SettingsForm"
import type { Settings } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useCan } from "@/lib/auth/session"

// P1-083: the shop's own settings (01-product-requirements.md §4). Owner,
// admin and viewer read them; only the owner sees save (BR-025, BR-029).

export default function SettingsPage() {
  const canRead = useCan("settings:read")
  const canWrite = useCan("settings:write")
  const { data, setData, error, loading } = useResource<Settings>(
    canRead ? "/v1/settings" : null,
  )

  if (!canRead)
    return (
      <Page title="Settings">
        <Empty title="You don't have access to the shop's settings." />
      </Page>
    )
  return (
    <Page
      title="Settings"
      description={
        canWrite
          ? "Your shop's name, time zone and order numbers."
          : "Only the shop's owner can change these."
      }
    >
      <ErrorNotice error={error} title="Could not load the settings" />
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <Card className="max-w-xl p-6">
          <SettingsForm
            key={JSON.stringify(data)}
            settings={data}
            canSave={canWrite}
            onSaved={setData}
          />
        </Card>
      ) : null}
    </Page>
  )
}
