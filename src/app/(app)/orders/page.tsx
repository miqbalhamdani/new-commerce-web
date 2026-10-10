"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import Button from "@/components/ui/button/Button"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { MultiSelect } from "@/components/ui/common/Select"
import { SearchInput } from "@/components/ui/common/SearchInput"
import { Select } from "@/components/ui/common/Select"
import { Empty, Loading, Page } from "@/components/ui/common/Page"
import { OrderTable } from "@/components/ui/orders/OrderTable"
import { ApiError } from "@/lib/api/client"
import type { OrderListRow, OrderPage, OrderStatus } from "@/lib/api/types"
import { asApiError, useApi, useResource } from "@/lib/api/use-api"
import { useCan, useSession } from "@/lib/auth/session"
import { cx } from "@/lib/utils"
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
  const { tenant } = useSession()
  const [cursor, setCursor] = useState<string | null>(null)
  const [markingPaid, setMarkingPaid] = useState<OrderListRow | null>(null)

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
    setCursor(null)
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
  return (
    <Page wide title="Orders" description="The day's work, by what it needs next.">
      <div
        role="group"
        aria-label="Saved views"
        className="mb-4 inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900"
      >
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={view === v.key}
            onClick={() =>
              update({ status: [...v.status], refund_owed: v.refund_owed })
            }
            className={cx(
              "whitespace-nowrap rounded-md px-3 py-2 text-theme-sm font-medium",
              view === v.key
                ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          aria-label="Search orders"
          placeholder="Order number, name, email or phone"
          className="w-full max-w-xs"
          defaultValue={filters.q}
          onKeyDown={(e) =>
            e.key === "Enter" && update({ q: e.currentTarget.value.trim() })
          }
          onBlur={(e) =>
            e.target.value.trim() !== filters.q &&
            update({ q: e.target.value.trim() })
          }
        />
        <MultiSelect
          aria-label="Status"
          placeholder="Any status"
          value={filters.status}
          onChange={(v) => update({ status: v as OrderStatus[], refund_owed: false })}
          options={statusValues.map((s) => ({ value: s, label: s }))}
        />
        <Select
          aria-label="Sort"
          value={filters.sort}
          onChange={(v) => update({ sort: v as OrderFilters["sort"] })}
          options={[
            { value: "-placed_at", label: "Newest" },
            { value: "placed_at", label: "Oldest" },
          ]}
        />
      </div>

      <ErrorNotice error={error} title="Could not load orders" />
      {loading && !data ? (
        <Loading />
      ) : data && data.data.length === 0 ? (
        <Empty title="No orders match">
          Clear a filter, or enter one manually.
        </Empty>
      ) : data ? (
        <OrderTable
          rows={data.data}
          timezone={tenant?.timezone}
          onMarkPaid={canWrite ? setMarkingPaid : undefined}
        />
      ) : null}
      {data?.next_cursor && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCursor(data.next_cursor)}
          >
            Next page
          </Button>
        </div>
      )}
      <MarkPaidDialog
        order={markingPaid}
        onClose={() => setMarkingPaid(null)}
        onDone={reload}
      />
    </Page>
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
