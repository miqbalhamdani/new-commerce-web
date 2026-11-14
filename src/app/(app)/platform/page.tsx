"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
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
import { SegmentedTabs } from "@/components/ui/common/SegmentedTabs"
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
  isPaying,
  needsAttention,
  planLabel,
  planOptions,
} from "@/lib/platform"

import { StatusBadge } from "./badges"
import { NewShopDialog } from "./dialogs"

// P1-903: Belli's own page, every shop on the platform (BR-150, 04-api-spec.md
// §14), for the session's platform_admin only; the route checks the email
// again. Four numbers and the shops; the funnel and per-plan counts fold into
// Insights, and each shop's details and actions are on its own page
// (/platform/{id}).

type Show = "all" | "attention" | "paying" | "demo"
const shows: readonly Show[] = ["all", "attention", "paying", "demo"]

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
  // The search and tab live in the URL too, so Back from a shop restores them.
  const [q, setQ] = useState(params.get("q") ?? "")
  const [show, setShow] = useState<Show>(() => {
    const s = params.get("show") as Show | null
    return s && shows.includes(s) ? s : "all"
  })
  function remember(next: { q?: string; show?: Show }) {
    const query = new URLSearchParams()
    const nq = next.q ?? q
    const ns = next.show ?? show
    if (nq) query.set("q", nq)
    if (ns !== "all") query.set("show", ns)
    router.replace(query.size ? `${pathname}?${query}` : pathname)
  }

  const all = useMemo(() => data?.shops ?? [], [data])
  const groups = useMemo(() => {
    const real = all.filter((s) => !isDemo(s))
    return {
      all: real,
      attention: real.filter((s) => needsAttention(s)),
      paying: real.filter(isPaying),
      demo: all.filter(isDemo),
    }
  }, [all])
  const shops = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return groups[show].filter(
      (s) =>
        !needle ||
        [s.name, s.slug, s.owner?.name, s.owner?.email].some((v) =>
          v?.toLowerCase().includes(needle),
        ),
    )
  }, [groups, show, q])

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
      description="Every shop on Belli, and the ones that need you."
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Figure
              label="Shops"
              value={sum.shops}
              hint={`+${sum.new_7d} this week`}
            />
            <Figure
              label="Active this week"
              value={sum.active_7d}
              hint="Signed in or changed something"
            />
            <Figure
              label="Need attention"
              value={groups.attention.length}
              hint="Unverified, asleep or plan ending"
            />
            <Figure
              label="Paying"
              value={groups.paying.length}
              hint="On Katalog or Jualan"
            />
          </div>

          <Insights shops={groups.all} summary={sum} />

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedTabs
              label="Show"
              options={[
                { value: "all", label: `All ${groups.all.length}` },
                {
                  value: "attention",
                  label: `Need attention ${groups.attention.length}`,
                },
                { value: "paying", label: `Paying ${groups.paying.length}` },
                { value: "demo", label: `Demo ${groups.demo.length}` },
              ]}
              value={show}
              onChange={(s) => {
                setShow(s)
                remember({ show: s })
              }}
            />
            <SearchInput
              aria-label="Search shops"
              placeholder="Shop, owner or email"
              className="w-full sm:ml-auto sm:w-64"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                remember({ q: e.target.value })
              }}
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
    <Card className="p-5">
      <p className="text-theme-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-title-sm font-bold tabular-nums text-gray-800 dark:text-white/90">
        {value}
      </p>
      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
        {hint}
      </p>
    </Card>
  )
}

/**
 * The signup funnel and the shops per plan, folded away until wanted. The
 * funnel counts shops that signed up themselves, as the summary does.
 */
function Insights({
  shops,
  summary: sum,
}: {
  shops: PlatformShop[]
  summary: PlatformShops["summary"]
}) {
  return (
    <details className="group rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-theme-sm font-medium text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-white/90 [&::-webkit-details-marker]:hidden">
        <span>
          Insights
          <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
            Signup funnel and shops per plan
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 text-gray-500 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="space-y-5 border-t border-gray-100 px-5 py-5 dark:border-white/[0.05]">
        <ol className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
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
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          {planOptions
            .map(
              (p) =>
                `${p.label} ${shops.filter((s) => s.plan === p.value).length}`,
            )
            .join(" · ")}
          {" · "}
          Plan ending within 7 days {shops.filter((s) => endsSoon(s)).length}
        </p>
      </div>
    </details>
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
