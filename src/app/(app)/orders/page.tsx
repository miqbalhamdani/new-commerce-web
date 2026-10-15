"use client"

import { ArrowLeft, ArrowRight, Download, Plus } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import { ButtonLink } from "@/components/ui/common/ButtonLink"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { MultiSelect } from "@/components/ui/common/Select"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { SegmentedTabs } from "@/components/ui/common/SegmentedTabs"
import { Card, Empty, Loading, Page } from "@/components/ui/common/Page"
import { ExportDialog } from "@/components/ui/orders/ExportDialog"
import { OrderTable } from "@/components/ui/orders/OrderTable"
import { NoteDialog } from "@/components/ui/orders/TransitionBar"
import { ApiError } from "@/lib/api/client"
import type { OrderListRow, OrderPage, OrderStatus } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import {
  activeView,
  filtersFromQuery,
  filtersToQuery,
  rememberedFilters,
  rememberFilters,
  statusValues,
  views,
  type OrderFilters,
} from "@/lib/orders/filters"

// P1-108: the ops workspace (04-api-spec.md §5.1). The saved views are plain
// filters; mark-paid works straight from the list (BR-070, BR-074).

export default function OrdersPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<Loading />}>
      <OrderList />
    </Suspense>
  )
}

function OrderList() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filters = filtersFromQuery(params)
  const canRead = useCan("orders:read")
  const canWrite = useCan("orders:write")
  const canExport = useCan("exports:read")
  const { tenant } = useSession()
  // The API pages forward only; the cursors already visited make "Previous".
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const cursor = cursors[cursors.length - 1]
  const [markingPaid, setMarkingPaid] = useState<OrderListRow | null>(null)
  const [cancelling, setCancelling] = useState<OrderListRow | null>(null)
  const [exporting, setExporting] = useState(false)

  // Coming back to a bare /orders restores the last filters used.
  useEffect(() => {
    if (params.toString() === "") {
      const saved = rememberedFilters()
      if (saved) router.replace(`${pathname}?${saved}`)
    } else {
      rememberFilters(params.toString())
    }
  }, [params, pathname, router])

  function update(next: Partial<OrderFilters>) {
    const q = filtersToQuery({ ...filters, ...next }).toString()
    rememberFilters(q)
    setCursors([null])
    router.replace(q ? `${pathname}?${q}` : pathname)
  }

  const query = filtersToQuery(filters)
  query.set("limit", "50")
  if (cursor) query.set("cursor", cursor)
  const { data, error, loading, reload } = useResource<OrderPage>(
    canRead ? `/v1/orders?${query}` : null,
  )

  if (!canRead) {
    return (
      <Page title="Orders">
        <Empty title="You don't have access to orders." />
      </Page>
    )
  }

  const view = activeView(filters)
  // A tab alone is undone by All; Clear is for a search or a custom status.
  const filtered = filters.q !== "" || view === null
  const clear = () =>
    update({ q: "", status: [], refund_owed: false })
  return (
    <Page wide title="Orders">
      {/* The saved views head the table's card; the other filters sit on the
          page. All is the empty filter. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          key={filters.q}
          aria-label="Search orders"
          placeholder="Order number, name, email or phone"
          // On the gray page the fields need their own fill.
          className="w-full sm:max-w-sm [&_input]:bg-white dark:[&_input]:bg-gray-900"
          defaultValue={filters.q}
          onKeyDown={(e) =>
            e.key === "Enter" && update({ q: e.currentTarget.value.trim() })
          }
          onBlur={(e) =>
            e.target.value.trim() !== filters.q &&
            update({ q: e.target.value.trim() })
          }
        />
        <div className="sm:w-48 [&_button]:bg-white dark:[&_button]:bg-gray-900">
          <MultiSelect
            aria-label="Status"
            placeholder="Status: Any"
            value={filters.status}
            onChange={(v) =>
              update({ status: v as OrderStatus[], refund_owed: false })
            }
            options={statusValues.map((s) => ({
              value: s,
              label: s[0].toUpperCase() + s.slice(1),
            }))}
          />
        </div>
        {filtered && (
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        )}
        <div className="flex gap-3 sm:ml-auto">
          {canExport && (
            <Button
              variant="outline"
              startIcon={<Download aria-hidden className="size-4" />}
              onClick={() => setExporting(true)}
            >
              Export CSV
            </Button>
          )}
          {canWrite && (
            <ButtonLink href="/orders/new">
              <Plus aria-hidden className="size-4" />
              New order
            </ButtonLink>
          )}
        </div>
      </div>

      <ErrorNotice error={error} title="Could not load orders" />
      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-gray-200 px-5 sm:px-6 dark:border-white/[0.05]">
          <SegmentedTabs
            variant="underline"
            label="Saved views"
            options={views.map((v) => ({ value: v.key, label: v.label }))}
            value={view}
            onChange={(key) => {
              const v = views.find((x) => x.key === key)!
              update({ status: [...v.status], refund_owed: v.refund_owed })
            }}
          />
        </div>
        {loading && !data ? (
          <Loading />
        ) : data && data.data.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
              No orders match
            </p>
            {filtered && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={clear}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : data ? (
          <OrderTable
            bare
            rows={data.data}
            timezone={tenant?.timezone}
            onMarkPaid={canWrite ? setMarkingPaid : undefined}
            onCancel={canWrite ? setCancelling : undefined}
            sort={filters.sort}
            onSort={() =>
              update({
                sort: filters.sort === "placed_at" ? "-placed_at" : "placed_at",
              })
            }
          />
        ) : null}

        {(cursors.length > 1 || data?.next_cursor) && (
          <nav
            aria-label="Orders pages"
            className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 sm:px-6 dark:border-white/[0.05]"
          >
            <Button
              size="sm"
              variant="outline"
              startIcon={<ArrowLeft className="size-4" />}
              disabled={cursors.length === 1}
              onClick={() => setCursors(cursors.slice(0, -1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              endIcon={<ArrowRight className="size-4" />}
              disabled={!data?.next_cursor}
              onClick={() =>
                data?.next_cursor && setCursors([...cursors, data.next_cursor])
              }
            >
              Next
            </Button>
          </nav>
        )}
      </Card>
      <MarkPaidDialog
        order={markingPaid}
        onClose={() => setMarkingPaid(null)}
        onDone={reload}
      />
      {exporting && (
        <ExportDialog seed={filters} onClose={() => setExporting(false)} />
      )}
      <CancelDialog
        order={cancelling}
        onClose={() => setCancelling(null)}
        onDone={reload}
      />
    </Page>
  )
}

/** Cancelling from the list (BR-070): the detail page's dialog, fed here. */
function CancelDialog({
  order,
  onClose,
  onDone,
}: {
  order: OrderListRow | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  function close() {
    setError(null)
    onClose()
  }
  async function cancel(reason: string) {
    if (!order) return
    setBusy(true)
    try {
      await api(`/v1/orders/${order.id}/cancel`, {
        method: "POST",
        body: reason ? { reason } : undefined,
      })
      close()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <NoteDialog
      key={order?.id ?? "closed"}
      open={order !== null}
      kind="cancel"
      error={error}
      busy={busy}
      onSubmit={(text) => void cancel(text)}
      onClose={close}
    />
  )
}

/** Confirming a bank transfer from the list (BR-074). */
function MarkPaidDialog({
  order,
  onClose,
  onDone,
}: {
  order: OrderListRow | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  function close() {
    setError(null)
    onClose()
  }
  async function markPaid() {
    if (!order) return
    setBusy(true)
    try {
      await api(`/v1/orders/${order.id}/mark-paid`, { method: "POST" })
      close()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={order !== null}
      onOpenChange={(o) => !o && close()}
      title={`Mark ${order?.order_number ?? ""} as paid?`}
      description="For a payment you've confirmed yourself, like a bank transfer. This can't be undone, only cancelled."
      footer={
        <>
          <Button size="sm" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" onClick={markPaid} isLoading={busy}>
            Mark as paid
          </Button>
        </>
      }
    >
      <ErrorNotice error={error} title="Could not mark it paid" />
    </Dialog>
  )
}
