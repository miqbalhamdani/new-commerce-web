"use client"

import { useState } from "react"

import Checkbox from "@/components/form/input/Checkbox"
import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field } from "@/components/ui/common/Field"
import { ApiError } from "@/lib/api/client"
import type { PlatformShop } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"

// P1-916: the platform admin's shop actions (BR-151, 04-api-spec.md §14.1).

/** Opens a shop held for a hand-over, or invited at once. */
export function NewShopDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const empty = { shop_name: "", owner_name: "", owner_email: "" }
  const [form, setForm] = useState(empty)
  const [sendInvite, setSendInvite] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api("/v1/platform/shops", {
        method: "POST",
        body: { ...form, send_invite: sendInvite },
      })
      setForm(empty)
      setSendInvite(false)
      setError(null)
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="New shop"
      description="The owner is invited but not emailed until you send the invite, so you can set the shop up first."
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          id="shop-name"
          label="Shop name"
          error={fieldError(error, "shop_name")}
        >
          <Input
            id="shop-name"
            required
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
          />
        </Field>
        <Field
          id="owner-name"
          label="Owner's name"
          error={fieldError(error, "owner_name")}
        >
          <Input
            id="owner-name"
            required
            value={form.owner_name}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
          />
        </Field>
        <Field
          id="owner-email"
          label="Owner's email"
          error={fieldError(error, "owner_email")}
        >
          <Input
            id="owner-email"
            type="email"
            required
            value={form.owner_email}
            onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
          />
        </Field>
        <Checkbox
          id="send-invite"
          label="Send the invite now"
          checked={sendInvite}
          onChange={setSendInvite}
        />
        {error && !error.problem.errors?.length && (
          <ErrorNotice error={error} title="Could not open the shop" />
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" isLoading={busy}>
            Open shop
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Changes an invited owner's email or name: the hand-over. */
export function OwnerDialog({
  shop,
  onClose,
  onDone,
}: {
  shop: PlatformShop | null
  onClose: () => void
  onDone: () => void
}) {
  return (
    <Dialog
      open={shop !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Change owner"
      description="Only until they confirm. This sends nothing: send the invite afterwards."
    >
      {/* Keyed, so each shop opens with its own owner filled in. */}
      {shop && (
        <OwnerForm
          key={shop.id}
          shop={shop}
          onClose={onClose}
          onDone={onDone}
        />
      )}
    </Dialog>
  )
}

function OwnerForm({
  shop,
  onClose,
  onDone,
}: {
  shop: PlatformShop
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [form, setForm] = useState({
    email: shop.owner?.email ?? "",
    name: shop.owner?.name ?? "",
  })
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/v1/platform/shops/${shop.id}/owner`, {
        method: "PATCH",
        body: form,
      })
      setError(null)
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field
        id="owner-email-edit"
        label="Email"
        error={fieldError(error, "email")}
      >
        <Input
          id="owner-email-edit"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field
        id="owner-name-edit"
        label="Name"
        error={fieldError(error, "name")}
      >
        <Input
          id="owner-name-edit"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      {error && !error.problem.errors?.length && (
        <ErrorNotice error={error} title="Could not change the owner" />
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" type="submit" isLoading={busy}>
          Save
        </Button>
      </div>
    </form>
  )
}

export type StatusChange = {
  shop: PlatformShop
  status: PlatformShop["status"]
}

const statusCopy = {
  suspended: {
    verb: "Suspend",
    text: "Its staff are signed out and can't sign in, and its website goes offline. You can reactivate it.",
  },
  closed: {
    verb: "Close",
    text: "Its staff are signed out and can't sign in, and its website goes offline. Nothing is deleted; you can reactivate it.",
  },
  active: {
    verb: "Reactivate",
    text: "Its staff can sign in again and its website comes back within a minute.",
  },
} as const

/** Confirms a status change (BR-151). */
export function StatusDialog({
  change,
  onClose,
  onDone,
}: {
  change: StatusChange | null
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const copy = change ? statusCopy[change.status] : null

  async function confirm() {
    if (!change) return
    setBusy(true)
    try {
      await api(`/v1/platform/shops/${change.shop.id}`, {
        method: "PATCH",
        body: { status: change.status },
      })
      setError(null)
      onClose()
      onDone()
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={change !== null}
      onOpenChange={(o) => !o && onClose()}
      title={`${copy?.verb ?? ""} ${change?.shop.name ?? ""}?`}
      description={copy?.text}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={change?.status === "active" ? "primary" : "destructive"}
            isLoading={busy}
            onClick={confirm}
          >
            {copy?.verb}
          </Button>
        </>
      }
    >
      <ErrorNotice error={error} />
    </Dialog>
  )
}
