"use client"

import { useState } from "react"

import Checkbox from "@/components/form/input/Checkbox"
import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { Dialog } from "@/components/ui/common/Dialog"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { DatePicker } from "@/components/ui/common/DatePicker"
import { Field } from "@/components/ui/common/Field"
import { Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { BusinessType, PlatformShop, ShopPlan } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"
import { businessTypeOptions, planOptions } from "@/lib/platform"

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
  const [plan, setPlan] = useState<ShopPlan>("mulai")
  const [businessType, setBusinessType] = useState<BusinessType>("retail")
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api("/v1/platform/shops", {
        method: "POST",
        body: {
          ...form,
          send_invite: sendInvite,
          plan,
          business_type: businessType,
        },
      })
      setForm(empty)
      setSendInvite(false)
      setPlan("mulai")
      setBusinessType("retail")
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
        <Field id="new-shop-plan" label="Plan" error={fieldError(error, "plan")}>
          <Select
            id="new-shop-plan"
            value={plan}
            onChange={(v) => setPlan(v as ShopPlan)}
            options={planOptions}
          />
        </Field>
        <Field
          id="new-shop-business-type"
          label="Business type"
          hint="An umrah travel agency's products are packages, and its website takes no orders."
          error={fieldError(error, "business_type")}
        >
          <Select
            id="new-shop-business-type"
            value={businessType}
            onChange={(v) => setBusinessType(v as BusinessType)}
            options={businessTypeOptions}
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

/** Sets a shop's plan and the date its paid period ends (BR-160). */
export function PlanDialog({
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
      title={`Plan for ${shop?.name ?? ""}`}
      description="Payment happens outside Belli. The shop's staff get the new plan when they next reload, within 15 minutes; the date is only shown here."
    >
      {shop && (
        <PlanForm key={shop.id} shop={shop} onClose={onClose} onDone={onDone} />
      )}
    </Dialog>
  )
}

function PlanForm({
  shop,
  onClose,
  onDone,
}: {
  shop: PlatformShop
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [plan, setPlan] = useState<ShopPlan>(shop.plan)
  const [until, setUntil] = useState(shop.plan_until ?? "")
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/v1/platform/shops/${shop.id}/plan`, {
        method: "PATCH",
        body: { plan, plan_until: until || null },
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
      <Field id="plan" label="Plan" error={fieldError(error, "plan")}>
        <Select
          id="plan"
          value={plan}
          onChange={(v) => setPlan(v as ShopPlan)}
          options={planOptions}
        />
      </Field>
      <Field
        id="plan-until"
        label="Paid until"
        hint="Optional. Leave empty when there is no end date."
        error={fieldError(error, "plan_until")}
      >
        <DatePicker id="plan-until" value={until} onChange={setUntil} />
      </Field>
      {error && !error.problem.errors?.length && (
        <ErrorNotice error={error} title="Could not change the plan" />
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

/** Sets a shop's business type (BR-170). */
export function BusinessTypeDialog({
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
      title={`Business type for ${shop?.name ?? ""}`}
      description="An umrah shop's products are packages with departures, hotels, seats and USD prices, and its website takes no orders. Nothing is deleted when this changes. Staff see it when they next reload, within 15 minutes."
    >
      {shop && (
        <BusinessTypeForm key={shop.id} shop={shop} onClose={onClose} onDone={onDone} />
      )}
    </Dialog>
  )
}

function BusinessTypeForm({
  shop,
  onClose,
  onDone,
}: {
  shop: PlatformShop
  onClose: () => void
  onDone: () => void
}) {
  const api = useApi()
  const [businessType, setBusinessType] = useState<BusinessType>(shop.business_type)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/v1/platform/shops/${shop.id}/business-type`, {
        method: "PATCH",
        body: { business_type: businessType },
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
      <Field id="business-type" label="Business type" error={fieldError(error, "business_type")}>
        <Select
          id="business-type"
          value={businessType}
          onChange={(v) => setBusinessType(v as BusinessType)}
          options={businessTypeOptions}
        />
      </Field>
      {error && !error.problem.errors?.length && (
        <ErrorNotice error={error} title="Could not change the business type" />
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
