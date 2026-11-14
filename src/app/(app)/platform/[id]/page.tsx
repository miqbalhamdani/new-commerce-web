"use client"

import { AlertCircle, Check, ExternalLink, X } from "lucide-react"
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
import { cx } from "@/lib/utils"

import { PlanBadges, StatusBadge } from "../badges"
import {
  BusinessTypeDialog,
  OwnerDialog,
  PlanDialog,
  StatusDialog,
  type StatusChange,
} from "../dialogs"

// One shop for the platform admin (BR-150, BR-151): the website, catalog and
// activity on the left; the owner, the plan and the danger zone, each with its
// actions, on the right. Read from the same report as the list; each action
// reloads it.

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
  const host = `${shop.slug}.${websiteDomain}`
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
      titleAddon={
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge shop={shop} />
          <PlanBadges shop={shop} />
        </span>
      }
      description={
        <>
          <a
            href={`https://${host}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            {host}
          </a>
          {` · Signed up ${formatRelative(shop.created_at)} via ${sourceLabel[shop.source]}`}
        </>
      }
      actions={
        <>
          <a
            href={`https://${host}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03]"
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
        <ErrorNotice error={actionError} title="That didn't work" />
        {notice && (
          <p role="status" className="text-theme-sm text-success-600">
            {notice}
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel
              title="Website and catalog"
              aside={
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  Theme{" "}
                  <span className="font-semibold text-gray-800 dark:text-white/90">
                    {shop.website.theme ?? "not picked"}
                  </span>
                </span>
              }
            >
              <ul className="grid gap-3 sm:grid-cols-3">
                <Setup on={shop.website.logo} label="Logo" />
                <Setup on={shop.website.whatsapp} label="WhatsApp" />
                <Setup
                  on={shop.website.set_up}
                  label="Website set up"
                  yes="Done"
                  no="Not yet"
                />
              </ul>
              <div className="mt-5 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2 dark:border-white/[0.05]">
                <Stat
                  label="Products"
                  value={shop.products.active}
                  rest={`live of ${shop.products.total}`}
                />
                <Stat
                  label="Orders"
                  value={shop.orders.total}
                  rest={`in all · ${shop.orders.last_30d} in the last 30 days`}
                />
              </div>
            </Panel>

            <Panel title="Activity">
              <ol className="relative ml-1.5 border-l border-gray-200 dark:border-gray-700">
                <TimelineItem
                  current
                  title="Last active"
                  detail={
                    shop.last_activity_at
                      ? `${formatRelative(shop.last_activity_at)} · ${formatDateTime(shop.last_activity_at, tz)}`
                      : "Not yet"
                  }
                />
                <TimelineItem
                  title="Signed up"
                  detail={`${formatDateTime(shop.created_at, tz)} · via ${sourceLabel[shop.source]}`}
                />
              </ol>
            </Panel>
          </div>

          <aside
            aria-label="Owner, plan and danger zone"
            className="flex flex-col gap-6"
          >
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
                  {invited ? (
                    <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-theme-sm text-warning-700 dark:bg-warning-500/15 dark:text-orange-400">
                      <AlertCircle aria-hidden className="size-4 shrink-0" />
                      Has not confirmed the email yet.
                    </p>
                  ) : (
                    <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                      {shop.owner.last_login_at
                        ? `Last signed in ${formatRelative(shop.owner.last_login_at)}.`
                        : "Has not signed in yet."}
                    </p>
                  )}
                  {invited && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendInvite(shop)}
                      >
                        Send invite
                      </Button>
                      <LinkButton onClick={() => setDialog("owner")}>
                        Change owner
                      </LinkButton>
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
                  <LinkButton
                    aria-label="Change plan"
                    onClick={() => setDialog("plan")}
                  >
                    Change
                  </LinkButton>
                }
              />
              <Fact
                label="Business type"
                value={
                  businessTypeOptions.find(
                    (o) => o.value === shop.business_type,
                  )?.label ?? shop.business_type
                }
                action={
                  <LinkButton
                    aria-label="Change business type"
                    onClick={() => setDialog("type")}
                  >
                    Change
                  </LinkButton>
                }
              />
            </Panel>

            <Card className="border-error-200 p-5 dark:border-error-500/30">
              <h2 className="text-theme-sm font-semibold text-error-600 dark:text-error-500">
                Danger zone
              </h2>
              <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                {shop.status === "active"
                  ? "Suspending or closing signs the shop's staff out and takes its website offline. Nothing is deleted."
                  : `The shop is ${shop.status}. Reactivating lets its staff sign in and puts the website back online.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {shop.status === "active" ? (
                  <>
                    <DangerButton
                      onClick={() => setChange({ shop, status: "suspended" })}
                    >
                      Suspend
                    </DangerButton>
                    <DangerButton
                      onClick={() => setChange({ shop, status: "closed" })}
                    >
                      Close
                    </DangerButton>
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
            </Card>
          </aside>
        </div>
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
  aside,
  children,
}: {
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h2>
        {aside}
      </div>
      <div>{children}</div>
    </Card>
  )
}

/** A label and its value, with an action on the right. */
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
    <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-3 first:border-t-0 first:pt-0 last:pb-0 dark:border-white/[0.05]">
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

/** One website step as a tile: an icon and its words, so colour is not the only cue. */
function Setup({
  on,
  label,
  yes = "Set",
  no = "Not set",
}: {
  on: boolean
  label: string
  yes?: string
  no?: string
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <span
        aria-hidden
        className={cx(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          on
            ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
            : "bg-gray-100 text-gray-400 dark:bg-white/5",
        )}
      >
        {on ? <Check className="size-4" /> : <X className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-theme-sm font-medium text-gray-800 dark:text-white/90">
          {label}
        </span>
        <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
          {on ? yes : no}
        </span>
      </span>
    </li>
  )
}

/** A big number with what it counts. */
function Stat({
  label,
  value,
  rest,
}: {
  label: string
  value: number
  rest: string
}) {
  return (
    <div>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        <span className="mr-1.5 text-2xl font-semibold tabular-nums text-gray-800 dark:text-white/90">
          {value}
        </span>
        {rest}
      </p>
    </div>
  )
}

/** One event on the activity line; current is the newest, in the brand colour. */
function TimelineItem({
  title,
  detail,
  current,
}: {
  title: string
  detail: string
  current?: boolean
}) {
  return (
    <li className="ml-5 pb-5 last:pb-0">
      <span
        aria-hidden
        className={cx(
          "absolute -left-[5px] mt-1.5 size-2.5 rounded-full ring-4 ring-white dark:ring-gray-900",
          current ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600",
        )}
      />
      <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
        {title}
      </p>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{detail}</p>
    </li>
  )
}

/** A quiet action that reads as a link: Change, Change owner. */
function LinkButton({
  onClick,
  children,
  "aria-label": ariaLabel,
}: {
  onClick: () => void
  children: React.ReactNode
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="rounded-lg px-2 py-2 text-sm font-medium text-brand-500 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10"
    >
      {children}
    </button>
  )
}

function DangerButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-4 py-2.5 text-sm font-medium text-error-600 ring-1 ring-inset ring-error-300 hover:bg-error-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 dark:text-error-500 dark:ring-error-500/40 dark:hover:bg-error-500/10"
    >
      {children}
    </button>
  )
}
