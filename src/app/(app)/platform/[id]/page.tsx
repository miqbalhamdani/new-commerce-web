"use client"

import { Check, ExternalLink, X } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"

import Button from "@/components/ui/button/Button"
import { ButtonLink } from "@/components/ui/common/ButtonLink"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { websiteDomain } from "@/components/ui/settings/SettingsForm"
import type { ApiError } from "@/lib/api/client"
import type { PlatformShop, PlatformShops } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { useSession } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatRelative } from "@/lib/format"
import { businessTypeOptions, endsSoon, planLabel } from "@/lib/platform"

import { PlanBadges, StatusBadge } from "../badges"
import {
  BusinessTypeDialog,
  OwnerDialog,
  PlanDialog,
  StatusDialog,
  type StatusChange,
} from "../dialogs"

// One shop for the platform admin (BR-150, BR-151): everything the list
// leaves out, and every action on the shop, grouped. Read from the same report
// as the list; each action reloads it.

const sourceLabel = {
  email: "the signup form",
  google: "Google",
  cli: "the CLI",
  platform: "Platform",
} as const

export default function PlatformShopPage() {
  const { id } = useParams<{ id: string }>()
  const { user, tenant, impersonate } = useSession()
  const router = useRouter()
  const api = useApi()
  const allowed = user?.platform_admin === true
  const { data, error, loading, reload } = useResource<PlatformShops>(
    allowed ? "/v1/platform/shops" : null,
  )
  const [dialog, setDialog] = useState<"owner" | "plan" | "type" | null>(null)
  const [change, setChange] = useState<StatusChange | null>(null)
  const [actionError, setActionError] = useState<ApiError | null>(null)
  const [notice, setNotice] = useState("")

  if (!allowed) {
    return (
      <Page title="Platform">
        <Empty title="You don't have access to the platform page." />
      </Page>
    )
  }
  if (loading && !data) return <Loading />
  const shop = data?.shops.find((s) => s.id === id)
  if (!shop) {
    return (
      <Page title="Shop">
        <ErrorNotice error={error} title="Could not load the shop" />
        {data && (
          <Empty title="No such shop.">
            <ButtonLink href="/platform" variant="outline">
              Back to Platform
            </ButtonLink>
          </Empty>
        )}
      </Page>
    )
  }

  const tz = tenant?.timezone
  const website = `https://${shop.slug}.${websiteDomain}`
  const invited = shop.owner?.status === "invited"

  // P1-917: the shop's own admin, as its owner, until Back to Platform.
  async function openAsOwner(s: PlatformShop) {
    setActionError(null)
    try {
      await impersonate(s.id)
      router.push("/")
    } catch (err) {
      setActionError(asApiError(err))
    }
  }

  async function sendInvite(s: PlatformShop) {
    setActionError(null)
    setNotice("")
    try {
      await api(`/v1/platform/shops/${s.id}/invite`, { method: "POST" })
      setNotice(`Invite sent to ${s.owner?.email}.`)
    } catch (err) {
      setActionError(asApiError(err))
    }
  }

  return (
    <Page
      wide
      title={shop.name}
      description={`${shop.slug}.${websiteDomain} · signed up ${formatRelative(shop.created_at)} via ${sourceLabel[shop.source]}`}
      actions={
        <>
          <a
            href={website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03]"
          >
            Visit website
            <ExternalLink aria-hidden className="size-4" />
          </a>
          <Button size="sm" onClick={() => openAsOwner(shop)}>
            Open as owner
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge shop={shop} />
          <PlanBadges shop={shop} />
        </div>
        <ErrorNotice error={actionError} title="That didn't work" />
        {notice && (
          <p role="status" className="text-theme-sm text-success-600">
            {notice}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Owner">
            {shop.owner ? (
              <>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {shop.owner.name}
                </p>
                <a
                  href={`mailto:${shop.owner.email}`}
                  className="text-theme-sm text-gray-500 hover:text-brand-500 dark:text-gray-400"
                >
                  {shop.owner.email}
                </a>
                <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                  {invited
                    ? "Has not confirmed the email yet."
                    : shop.owner.last_login_at
                      ? `Last signed in ${formatRelative(shop.owner.last_login_at)}.`
                      : "Has not signed in yet."}
                </p>
                {invited && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendInvite(shop)}
                    >
                      Send invite
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDialog("owner")}
                    >
                      Change owner
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-theme-sm text-gray-500">No owner.</p>
            )}
          </Panel>

          <Panel title="Plan">
            <Fact
              label="Plan"
              value={
                shop.plan_until
                  ? `${planLabel(shop.plan)} until ${formatDate(shop.plan_until, tz)}`
                  : `${planLabel(shop.plan)}, no end date`
              }
              warn={endsSoon(shop) ? "Ends within 7 days" : undefined}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialog("plan")}
                >
                  Change
                </Button>
              }
            />
            <Fact
              label="Business type"
              value={
                businessTypeOptions.find((o) => o.value === shop.business_type)
                  ?.label ?? shop.business_type
              }
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialog("type")}
                >
                  Change
                </Button>
              }
            />
          </Panel>

          <Panel title="Website and catalog">
            <Fact
              label="Theme"
              value={shop.website.theme ?? "Not picked yet"}
            />
            <ul className="flex flex-wrap gap-x-5 gap-y-2 py-3 text-theme-sm">
              <Check3 on={shop.website.logo} label="Logo" />
              <Check3 on={shop.website.whatsapp} label="WhatsApp" />
              <Check3 on={shop.website.set_up} label="Website set up" />
            </ul>
            <Fact
              label="Products"
              value={`${shop.products.active} live of ${shop.products.total}`}
            />
            <Fact
              label="Orders"
              value={`${shop.orders.total} in all · ${shop.orders.last_30d} in 30 days`}
            />
          </Panel>

          <Panel title="Activity">
            <Fact
              label="Last active"
              value={
                shop.last_activity_at
                  ? `${formatRelative(shop.last_activity_at)} (${formatDateTime(shop.last_activity_at, tz)})`
                  : "Never"
              }
            />
            <Fact
              label="Signed up"
              value={formatDateTime(shop.created_at, tz)}
            />
          </Panel>
        </div>

        <Card className="border-error-200 p-5 dark:border-error-500/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-theme-sm font-semibold text-error-600 dark:text-error-500">
                Danger zone
              </h2>
              <p className="mt-1 max-w-xl text-theme-sm text-gray-500 dark:text-gray-400">
                {shop.status === "active"
                  ? "Suspending or closing signs the shop's staff out and takes its website offline. Nothing is deleted."
                  : `The shop is ${shop.status}. Reactivating lets its staff sign in and puts the website back online.`}
              </p>
            </div>
            <div className="flex gap-2">
              {shop.status === "active" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="!text-error-600 !ring-error-300"
                    onClick={() => setChange({ shop, status: "suspended" })}
                  >
                    Suspend
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="!text-error-600 !ring-error-300"
                    onClick={() => setChange({ shop, status: "closed" })}
                  >
                    Close
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setChange({ shop, status: "active" })}
                >
                  Reactivate
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <OwnerDialog
        shop={dialog === "owner" ? shop : null}
        onClose={() => setDialog(null)}
        onDone={reload}
      />
      <PlanDialog
        shop={dialog === "plan" ? shop : null}
        onClose={() => setDialog(null)}
        onDone={reload}
      />
      <BusinessTypeDialog
        shop={dialog === "type" ? shop : null}
        onClose={() => setDialog(null)}
        onDone={reload}
      />
      <StatusDialog
        change={change}
        onClose={() => setChange(null)}
        onDone={reload}
      />
    </Page>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
        {title}
      </h2>
      <div>{children}</div>
    </Card>
  )
}

/** A label and its value on one line, with an optional action on the right. */
function Fact({
  label,
  value,
  warn,
  action,
}: {
  label: string
  value: string
  warn?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-3 first:border-t-0 first:pt-0 dark:border-white/[0.05]">
      <div className="min-w-0">
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="text-theme-sm text-gray-800 dark:text-white/90">
          {value}
        </p>
        {warn && <p className="text-theme-xs text-warning-600">{warn}</p>}
      </div>
      {action}
    </div>
  )
}

/** A website fact as an icon and its words, so colour is not the only cue. */
function Check3({ on, label }: { on: boolean; label: string }) {
  return (
    <li
      className={
        on
          ? "flex items-center gap-1.5 text-gray-800 dark:text-white/90"
          : "flex items-center gap-1.5 text-gray-500 dark:text-gray-400"
      }
    >
      {on ? (
        <Check aria-hidden className="size-4 text-success-500" />
      ) : (
        <X aria-hidden className="size-4 text-gray-400" />
      )}
      <span>
        {label}
        <span className="sr-only">{on ? ": yes" : ": no"}</span>
      </span>
    </li>
  )
}
