"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"

import Badge from "@/components/ui/badge/Badge"
import Button from "@/components/ui/button/Button"
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
import { Select } from "@/components/ui/common/Select"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { PlatformShop, PlatformShops } from "@/lib/api/types"
import { useResource } from "@/lib/api/use-api"
import { useSession } from "@/lib/auth/session"
import { formatDate, formatDateTime, formatRelative } from "@/lib/format"
import {
  endsSoon,
  isDemo,
  planLabel,
  planOptions,
  statusOf,
  statusOptions,
} from "@/lib/platform"

import { StatusBadge } from "./badges"
import { NewShopDialog } from "./dialogs"

// P1-903: Belli's own page, every shop on the platform (BR-150, 04-api-spec.md
// §14), for the session's platform_admin only; the route checks the email
// again. Insights, then the shops, filtered by status, plan and real or demo;
// each shop's details and actions are on its own page (/platform/{id}).

type Filters = { q: string; status: string; plan: string; demo: boolean }

export default function PlatformPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PlatformList />
    </Suspense>
  )
}

function PlatformList() {
  const { user, tenant } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const allowed = user?.platform_admin === true
  const { data, error, loading, reload } = useResource<PlatformShops>(
    allowed ? "/v1/platform/shops" : null,
  )
  const [creating, setCreating] = useState(false)
  // The filters live in the URL too, so Back from a shop restores them.
  const [filters, setFilters] = useState<Filters>(() => ({
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    plan: params.get("plan") ?? "",
    demo: params.get("demo") === "1",
  }))
  function filter(next: Partial<Filters>) {
    const f = { ...filters, ...next }
    setFilters(f)
    const query = new URLSearchParams()
    if (f.q) query.set("q", f.q)
    if (f.status) query.set("status", f.status)
    if (f.plan) query.set("plan", f.plan)
    if (f.demo) query.set("demo", "1")
    router.replace(query.size ? `${pathname}?${query}` : pathname)
  }

  const real = useMemo(
    () => (data?.shops ?? []).filter((s) => !isDemo(s)),
    [data],
  )
  const shops = useMemo(() => {
    const needle = filters.q.trim().toLowerCase()
    return (data?.shops ?? []).filter(
      (s) =>
        isDemo(s) === filters.demo &&
        (!filters.status || statusOf(s).key === filters.status) &&
        (!filters.plan || s.plan === filters.plan) &&
        (!needle ||
          [s.name, s.slug, s.owner?.name, s.owner?.email].some((v) =>
            v?.toLowerCase().includes(needle),
          )),
    )
  }, [data, filters])

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
      description="Every shop on Belli: how signups go, and each shop's state."
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          New shop
        </Button>
      }
    >
      <ErrorNotice error={error} title="Could not load the shops" />
      <NewShopDialog
        open={creating}
        onClose={() => setCreating(false)}
        onDone={reload}
      />
      {loading && !data ? (
        <Loading />
      ) : data && sum ? (
        <div className="space-y-6">
          <Insights shops={real} summary={sum} />

          <div className="flex flex-wrap items-center gap-3">
            <Select
              aria-label="Status"
              className="w-full sm:w-44"
              value={filters.status}
              onChange={(status) => filter({ status })}
              options={[{ value: "", label: "All statuses" }, ...statusOptions]}
            />
            <Select
              aria-label="Plan"
              className="w-full sm:w-40"
              value={filters.plan}
              onChange={(plan) => filter({ plan })}
              options={[{ value: "", label: "All plans" }, ...planOptions]}
            />
            <Select
              aria-label="Shops"
              className="w-full sm:w-40"
              value={filters.demo ? "demo" : ""}
              onChange={(v) => filter({ demo: v === "demo" })}
              options={[
                { value: "", label: "Real shops" },
                { value: "demo", label: "Demo shops" },
              ]}
            />
            <SearchInput
              aria-label="Search shops"
              placeholder="Shop, owner or email"
              className="w-full sm:ml-auto sm:w-64"
              value={filters.q}
              onChange={(e) => filter({ q: e.target.value })}
            />
          </div>

          {shops.length === 0 ? (
            <Empty title="No shops match." />
          ) : (
            <ListTable>
              <TableHeader className={headerRow}>
                <TableRow>
                  {["Shop", "Status", "Plan", "Activity", ""].map((h) => (
                    <TableCell key={h} isHeader className={th}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className={bodyRows}>
                {shops.map((s) => (
                  <ShopRow
                    key={s.id}
                    shop={s}
                    timeZone={tenant?.timezone}
                    onOpen={() => router.push(`/platform/${s.id}`)}
                  />
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

/**
 * The signup funnel and the shops per plan. The funnel counts shops that
 * signed up themselves, as the report's summary does.
 */
function Insights({
  shops,
  summary: sum,
}: {
  shops: PlatformShop[]
  summary: PlatformShops["summary"]
}) {
  return (
    <Card className="p-5">
      <h2 className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
        Insights
        <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
          Signup funnel and shops per plan
        </span>
      </h2>
      <ol className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {(
          [
            ["Signed up", sum.shops],
            ["Verified email", sum.verified],
            ["Set up the website", sum.website_set_up],
            ["Added a product", sum.with_products],
            ["Got an order", sum.with_orders],
          ] as const
        ).map(([label, n]) => (
          <FunnelStep key={label} label={label} value={n} of={sum.shops} />
        ))}
      </ol>
      <p className="mt-5 text-theme-sm text-gray-600 dark:text-gray-400">
        {planOptions
          .map(
            (p) =>
              `${p.label} ${shops.filter((s) => s.plan === p.value).length}`,
          )
          .join(" · ")}
        {" · "}
        Plan ending within 7 days {shops.filter((s) => endsSoon(s)).length}
      </p>
    </Card>
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

/** One shop: who, its state, its plan and how busy it is. The row opens it. */
function ShopRow({
  shop: s,
  timeZone,
  onOpen,
}: {
  shop: PlatformShop
  timeZone?: string
  onOpen: () => void
}) {
  const muted = "text-theme-xs text-gray-500 dark:text-gray-400"
  return (
    <TableRow
      onClick={onOpen}
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
    >
      <TableCell className={td}>
        <span className="flex flex-wrap items-center gap-2">
          <Link
            href={`/platform/${s.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
          >
            {s.name}
          </Link>
          {s.business_type === "umrah" && (
            <Badge size="sm" color="info">
              Umrah
            </Badge>
          )}
        </span>
        <p className={muted}>{s.owner?.email ?? "No owner"}</p>
      </TableCell>
      <TableCell className={td}>
        <StatusBadge shop={s} />
      </TableCell>
      <TableCell className={td}>
        <p className="text-gray-800 dark:text-white/90">{planLabel(s.plan)}</p>
        {s.plan_until && (
          <p className={endsSoon(s) ? "text-theme-xs text-warning-600" : muted}>
            Until {formatDate(s.plan_until, timeZone)}
          </p>
        )}
      </TableCell>
      <TableCell className={td}>
        <p
          className="text-gray-800 dark:text-white/90"
          title={formatDateTime(s.last_activity_at, timeZone)}
        >
          {s.last_activity_at ? formatRelative(s.last_activity_at) : "Never"}
        </p>
        <p className={`${muted} tabular-nums`}>
          {s.products.total} product{s.products.total === 1 ? "" : "s"} ·{" "}
          {s.orders.total} order{s.orders.total === 1 ? "" : "s"}
        </p>
      </TableCell>
      <TableCell className={`${td} w-px`}>
        <ChevronRight aria-hidden className="size-4 text-gray-400" />
      </TableCell>
    </TableRow>
  )
}
