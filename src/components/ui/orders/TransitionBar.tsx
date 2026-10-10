"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field, Textarea } from "@/components/ui/common/Field"
import { ApiError } from "@/lib/api/client"
import type { Order, OrderStatus } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"

// The §5.3 status actions (P1-109): one button per entry in the order's own
// allowed_transitions, never a hardcoded list, plus "Record refund" beside
// them when BR-075 allows it. Repeats are harmless no-ops (BR-071).

const actions: Record<
  OrderStatus,
  { label: string; route: string; dialog?: "ship" | "cancel" }
> = {
  paid: { label: "Mark as paid", route: "mark-paid" },
  processing: { label: "Start processing", route: "process" },
  shipped: { label: "Ship order…", route: "ship", dialog: "ship" },
  completed: { label: "Complete order", route: "complete" },
  cancelled: { label: "Cancel order…", route: "cancel", dialog: "cancel" },
  pending: { label: "pending", route: "" }, // never offered by the allow-list
}

export function TransitionBar({
  order,
  onChanged,
  onReload,
}: {
  order: Order
  onChanged: (o: Order) => void
  onReload: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dialog, setDialog] = useState<"ship" | "cancel" | "refund" | null>(null)

  async function post(route: string, body?: Record<string, unknown>) {
    setBusy(route)
    try {
      const o = await api<Order>(`/v1/orders/${order.id}/${route}`, {
        method: "POST",
        body,
      })
      setError(null)
      setDialog(null)
      onChanged(o)
      return true
    } catch (err) {
      setError(asApiError(err))
      return false
    } finally {
      setBusy(null)
    }
  }

  const refundable =
    order.status === "cancelled" && order.paid_at && !order.refunded_at

  return (
    <div className="flex flex-col gap-3">
      {order.allowed_transitions.map((to) => {
        const a = actions[to]
        return (
          <Button
            key={to}
            size="sm"
            variant={to === "cancelled" ? "outline" : "primary"}
            className="w-full"
            isLoading={busy === a.route}
            onClick={() => (a.dialog ? setDialog(a.dialog) : void post(a.route))}
          >
            {a.label}
          </Button>
        )
      })}
      {refundable && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => setDialog("refund")}
        >
          Record refund…
        </Button>
      )}

      {error?.code === "illegal_transition" ? (
        <div
          role="alert"
          className="rounded-xl border border-warning-500 bg-warning-50 p-3 text-theme-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-orange-400"
        >
          This order moved on since you loaded it.{" "}
          <button type="button" className="font-medium underline" onClick={onReload}>
            Reload it
          </button>{" "}
          to see where it is now.
        </div>
      ) : (
        dialog === null && <ErrorNotice error={error} title="Could not update the order" />
      )}

      <ShipDialog
        open={dialog === "ship"}
        order={order}
        error={error}
        busy={busy === "ship"}
        onSubmit={(body) => void post("ship", body)}
        onClose={() => {
          setDialog(null)
          setError(null)
        }}
      />
      <NoteDialog
        key={dialog ?? "closed"}
        open={dialog === "cancel" || dialog === "refund"}
        kind={dialog === "refund" ? "refund" : "cancel"}
        error={error}
        busy={busy === "cancel" || busy === "refund"}
        onSubmit={(text) =>
          void post(
            dialog === "refund" ? "refund" : "cancel",
            text ? (dialog === "refund" ? { note: text } : { reason: text }) : undefined,
          )
        }
        onClose={() => {
          setDialog(null)
          setError(null)
        }}
      />
    </div>
  )
}

/** Shipping needs a courier and a tracking number (BR-072). */
function ShipDialog({
  open,
  order,
  error,
  busy,
  onSubmit,
  onClose,
}: {
  open: boolean
  order: Order
  error: ApiError | null
  busy: boolean
  onSubmit: (body: { courier: string; tracking_number: string }) => void
  onClose: () => void
}) {
  const [courier, setCourier] = useState(order.shipping_courier ?? "")
  const [tracking, setTracking] = useState("")
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Ship ${order.order_number}`}
      description="The customer sees the courier and tracking number in their order history."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit({ courier: courier.trim(), tracking_number: tracking.trim() })
        }}
        className="flex flex-col gap-4"
      >
        <Field
          id="ship-courier"
          label="Courier"
          hint="A Biteship code, like jne or sicepat."
          error={fieldError(error, "courier")}
        >
          <Input
            id="ship-courier"
            value={courier}
            error={Boolean(fieldError(error, "courier"))}
            onChange={(e) => setCourier(e.target.value)}
          />
        </Field>
        <Field
          id="ship-tracking"
          label="Tracking number"
          error={fieldError(error, "tracking_number")}
        >
          <Input
            id="ship-tracking"
            value={tracking}
            error={Boolean(fieldError(error, "tracking_number"))}
            onChange={(e) => setTracking(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <Button size="sm" type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            isLoading={busy}
            disabled={!courier.trim() || !tracking.trim()}
          >
            Mark as shipped
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Cancel's reason and refund's note live in the audit trail only (BR-073, BR-075). */
function NoteDialog({
  open,
  kind,
  error,
  busy,
  onSubmit,
  onClose,
}: {
  open: boolean
  kind: "cancel" | "refund"
  error: ApiError | null
  busy: boolean
  onSubmit: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState("")
  const copy =
    kind === "refund"
      ? {
          title: "Record the refund",
          description:
            "The money moved outside the system — a bank transfer, or the Midtrans dashboard. Recording it takes this order off the refund-owed list.",
          label: "Note",
          action: "Record refund",
        }
      : {
          title: "Cancel this order?",
          description:
            "A paid order stays on the refund-owed list until its refund is recorded. Cancelling can't be undone.",
          label: "Reason",
          action: "Cancel order",
        }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={copy.title}
      description={copy.description}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(text.trim())
        }}
        className="flex flex-col gap-4"
      >
        <Field
          id="transition-note"
          label={copy.label}
          hint="Optional; kept in the order's history."
        >
          <Textarea
            id="transition-note"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        {error && <ErrorNotice error={error} title="That didn't go through" />}
        <div className="flex justify-end gap-3">
          <Button size="sm" type="button" variant="outline" onClick={onClose}>
            Keep it
          </Button>
          <Button
            size="sm"
            type="submit"
            variant={kind === "cancel" ? "destructive" : "primary"}
            isLoading={busy}
          >
            {copy.action}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
