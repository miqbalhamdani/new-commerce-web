"use client"

import { Globe, MessageCircle, Image as ImageIcon } from "lucide-react"
import { useMemo, useState } from "react"

import Badge from "@/components/ui/badge/Badge"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import {
  bodyRows,
  headerRow,
  ListTable,
  td,
  th,
} from "@/components/ui/common/Listing"
import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { SegmentedTabs } from "@/components/ui/common/SegmentedTabs"
import { Toggle } from "@/components/ui/common/Toggle"
import { websiteDomain } from "@/components/ui/settings/SettingsForm"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PlatformShop, PlatformShops } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useSession } from "@/lib/auth/session"
import { formatDateTime, formatRelative } from "@/lib/format"
import { isSleeping } from "@/lib/platform"

// P1-903: Belli's own page, every shop on the platform (BR-150, 04-api-spec.md
// §14). Shown only for the session's platform_admin; the route checks the
// email again and answers 403 to anyone else.

type Filter = "all" | "unverified" | "sleeping"

const filters = [
  { value: "all", label: "All" },
  { value: "unverified", label: "Not verified" },
  { value: "sleeping", label: "Sleeping" },
] as const

export default function PlatformPage() {
  const { user, tenant } = useSession()
  const allowed = user?.platform_admin === true
  const { data, error, loading } = useResource<PlatformShops>(
    allowed ? "/v1/platform/shops" : null,
  )
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [showCli, setShowCli] = useState(false)

  const shops = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data?.shops ?? []).filter((s) => {
      if (!showCli && s.source === "cli") return false
      if (filter === "unverified" && s.owner?.status !== "invited") return false
      if (filter === "sleeping" && !isSleeping(s)) return false
      if (!needle) return true
      return [s.name, s.slug, s.owner?.name, s.owner?.email].some((v) =>
        v?.toLowerCase().includes(needle),
      )
    })
  }, [data, q, filter, showCli])

  if (!allowed) {
    return (
      <Page title="Platform">
        <Empty title="You don't have access to the platform page." />
      </Page>
    )
  }

  const sum = data?.summary
  return (
    <Page
      wide
      title="Platform"
      description="Every shop on Belli: who signed up, how far each got, and who went quiet."
    >
      <ErrorNotice error={error} title="Could not load the shops" />
      {loading && !data ? (
        <Loading />
      ) : data && sum ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Figure
              label="Shops"
              value={sum.shops}
              hint={`${sum.new_7d} this week · ${sum.new_30d} in 30 days`}
            />
            <Figure
              label="Active this week"
              value={sum.active_7d}
              hint="Signed in or changed something"
            />
            <Figure
              label="Sleeping"
              value={sum.sleeping}
              hint="Verified, quiet for 14 days"
            />
            <Figure
              label="Not verified"
              value={sum.shops - sum.verified}
              hint="Never confirmed their email"
            />
          </div>

          {/* One strip, not a stacked list, so the shops table stays in view. */}
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                Signup funnel
              </h2>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Shops that signed up themselves; CLI and demo shops are not
                counted.
              </p>
            </div>
            <ol className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["Signed up", sum.shops],
                ["Verified email", sum.verified],
                ["Set up the website", sum.website_set_up],
                ["Added a product", sum.with_products],
                ["Got an order", sum.with_orders],
              ].map(([label, n]) => (
                <FunnelStep
                  key={label}
                  label={String(label)}
                  value={Number(n)}
                  of={sum.shops}
                />
              ))}
            </ol>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              aria-label="Search shops"
              placeholder="Shop, owner or email"
              className="w-full max-w-xs"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <SegmentedTabs
              label="Show"
              options={filters}
              value={filter}
              onChange={setFilter}
            />
            <span className="flex items-center gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
              <Toggle
                label="CLI and demo shops"
                checked={showCli}
                onChange={setShowCli}
              />
              <span aria-hidden>CLI and demo shops</span>
            </span>
          </div>

          {shops.length === 0 ? (
            <Empty title="No shops match." />
          ) : (
            <ListTable>
              <TableHeader className={headerRow}>
                <TableRow>
                  {[
                    "Shop",
                    "Owner",
                    "Signed up",
                    "Status",
                    "Website",
                    "Products",
                    "Orders",
                    "Last active",
                  ].map((h) => (
                    <TableCell key={h} isHeader className={th}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className={bodyRows}>
                {shops.map((s) => (
                  <ShopRow key={s.id} shop={s} timeZone={tenant?.timezone} />
                ))}
              </TableBody>
            </ListTable>
          )}
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            As of {formatDateTime(data.generated_at, tenant?.timezone)}.
          </p>
        </div>
      ) : null}
    </Page>
  )
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-title-sm font-bold tabular-nums text-gray-800 dark:text-white/90">
        {value}
      </p>
      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
        {hint}
      </p>
    </div>
  )
}

function FunnelStep({
  label,
  value,
  of,
}: {
  label: string
  value: number
  of: number
}) {
  const pct = of > 0 ? Math.round((value / of) * 100) : 0
  return (
    <li>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 tabular-nums">
        <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {value}
        </span>
        <span className="ml-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
          {pct}%
        </span>
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-1.5 rounded-full bg-brand-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  )
}

const sourceLabel = { email: "Email", google: "Google", cli: "CLI" } as const

function ShopRow({
  shop: s,
  timeZone,
}: {
  shop: PlatformShop
  timeZone?: string
}) {
  const muted = `${td} text-gray-500 dark:text-gray-400`
  return (
    <TableRow>
      <TableCell className={td}>
        <a
          href={`https://${s.slug}.${websiteDomain}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
        >
          {s.name}
        </a>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {s.slug}.{websiteDomain}
        </p>
      </TableCell>
      <TableCell className={td}>
        {s.owner ? (
          <>
            <p className="text-gray-800 dark:text-white/90">{s.owner.name}</p>
            <a
              href={`mailto:${s.owner.email}`}
              className="text-theme-xs text-gray-500 hover:text-brand-500 dark:text-gray-400"
            >
              {s.owner.email}
            </a>
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className={muted}>
        <span title={formatDateTime(s.created_at, timeZone)}>
          {formatRelative(s.created_at)}
        </span>
        <p className="text-theme-xs">{sourceLabel[s.source]}</p>
      </TableCell>
      <TableCell className={td}>
        <ShopStatus shop={s} />
      </TableCell>
      <TableCell className={muted}>
        <span className="flex items-center gap-2">
          <span>{s.website.theme ?? "—"}</span>
          <Mark on={s.website.logo} label="Logo">
            <ImageIcon className="size-4" />
          </Mark>
          <Mark on={s.website.whatsapp} label="WhatsApp">
            <MessageCircle className="size-4" />
          </Mark>
          <Mark on={s.website.set_up} label="Website set up">
            <Globe className="size-4" />
          </Mark>
        </span>
      </TableCell>
      <TableCell className={`${muted} tabular-nums`}>
        {s.products.active} / {s.products.total}
      </TableCell>
      <TableCell className={`${muted} tabular-nums`}>
        {s.orders.total}
        {s.orders.last_30d > 0 && (
          <span className="text-theme-xs"> · {s.orders.last_30d} in 30d</span>
        )}
      </TableCell>
      <TableCell className={muted}>
        <span title={formatDateTime(s.last_activity_at, timeZone)}>
          {formatRelative(s.last_activity_at)}
        </span>
      </TableCell>
    </TableRow>
  )
}

function ShopStatus({ shop }: { shop: PlatformShop }) {
  if (shop.status !== "active")
    return (
      <Badge size="sm" color="error">
        {shop.status === "suspended" ? "Suspended" : "Closed"}
      </Badge>
    )
  if (shop.owner?.status === "invited")
    return (
      <Badge size="sm" color="warning">
        Not verified
      </Badge>
    )
  if (isSleeping(shop))
    return (
      <Badge size="sm" color="light">
        Sleeping
      </Badge>
    )
  return (
    <Badge size="sm" color="success">
      Active
    </Badge>
  )
}

/** One website fact as an icon: coloured when set, faint when not. */
function Mark({
  on,
  label,
  children,
}: {
  on: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <span
      title={`${label}: ${on ? "yes" : "no"}`}
      aria-label={`${label}: ${on ? "yes" : "no"}`}
      className={on ? "text-success-500" : "text-gray-300 dark:text-gray-700"}
    >
      {children}
    </span>
  )
}
