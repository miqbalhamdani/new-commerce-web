"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { CopyField } from "@/components/ui/common/CopyField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Checkbox, Field, Textarea } from "@/components/ui/common/Field"
import { Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { CourierCode, StorefrontSettings } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"

/** The Biteship couriers a shop can offer (the contract's CourierCode). */
export const couriers: { code: CourierCode; label: string }[] = [
  { code: "jne", label: "JNE" },
  { code: "jnt", label: "J&T Express" },
  { code: "sicepat", label: "SiCepat" },
  { code: "anteraja", label: "AnterAja" },
  { code: "pos", label: "POS Indonesia" },
  { code: "tiki", label: "TIKI" },
  { code: "ninja", label: "Ninja Xpress" },
  { code: "lion", label: "Lion Parcel" },
  { code: "idexpress", label: "ID Express" },
  { code: "sap", label: "SAP Express" },
  { code: "rpx", label: "RPX" },
  { code: "wahana", label: "Wahana" },
]

type Form = {
  contact_email: string
  google_client_id: string
  origin_postal_code: string
  shipping_couriers: CourierCode[]
  bank_transfer_enabled: boolean
  bank_transfer_instructions: string
  midtrans_enabled: boolean
  midtrans_environment: "" | "sandbox" | "production"
  midtrans_client_key: string
}

const nullable = [
  "contact_email",
  "google_client_id",
  "origin_postal_code",
  "bank_transfer_instructions",
  "midtrans_environment",
  "midtrans_client_key",
] as const

function formOf(s: StorefrontSettings): Form {
  return {
    contact_email: s.contact_email ?? "",
    google_client_id: s.google_client_id ?? "",
    origin_postal_code: s.origin_postal_code ?? "",
    shipping_couriers: s.shipping_couriers,
    bank_transfer_enabled: s.bank_transfer_enabled,
    bank_transfer_instructions: s.bank_transfer_instructions ?? "",
    midtrans_enabled: s.midtrans_enabled,
    midtrans_environment: s.midtrans_environment ?? "",
    midtrans_client_key: s.midtrans_client_key ?? "",
  }
}

/**
 * How the shop's website sells (04-api-spec.md §4; BR-120, BR-122, BR-127,
 * BR-129). The Midtrans server key is write-only: the screen shows whether
 * one is set and offers to replace it, and never has the key to show.
 */
export function StorefrontSettingsForm({
  settings,
  canSave,
  onSaved,
}: {
  settings: StorefrontSettings
  canSave: boolean
  onSaved: (s: StorefrontSettings) => void
}) {
  const api = useApi()
  const initial = formOf(settings)
  const [form, setForm] = useState(initial)
  const [serverKey, setServerKey] = useState("")
  const [replacing, setReplacing] = useState(!settings.midtrans_server_key_set)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  // Only what changed, with an emptied text field sent as null (BR-009).
  function changes(): Record<string, unknown> {
    const body: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(form) as [
      keyof Form,
      Form[keyof Form],
    ][]) {
      if (JSON.stringify(v) === JSON.stringify(initial[k])) continue
      body[k] =
        (nullable as readonly string[]).includes(k) && v === "" ? null : v
    }
    if (serverKey.trim()) body.midtrans_server_key = serverKey.trim()
    return body
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const body = changes()
    if (!Object.keys(body).length) return
    setBusy(true)
    try {
      const s = await api<StorefrontSettings>("/v1/storefront-settings", {
        method: "PATCH",
        body,
      })
      setError(null)
      onSaved(s)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  function toggleCourier(code: CourierCode, on: boolean) {
    setForm({
      ...form,
      shipping_couriers: on
        ? couriers
            .map((c) => c.code)
            .filter((c) => c === code || form.shipping_couriers.includes(c))
        : form.shipping_couriers.filter((c) => c !== code),
    })
  }

  const section =
    "flex flex-col gap-4 border-t border-gray-100 pt-5 dark:border-gray-800"
  const heading = "text-sm font-semibold text-gray-800 dark:text-white/90"

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <fieldset disabled={!canSave} className="flex flex-col gap-5">
        <Field
          id="contact-email"
          label="Contact email"
          error={fieldError(error, "contact_email")}
          hint="Customers' replies to your shop's emails go here."
        >
          <Input
            id="contact-email"
            type="email"
            value={form.contact_email}
            onChange={(e) =>
              setForm({ ...form, contact_email: e.target.value })
            }
          />
        </Field>

        <div className={section}>
          <h3 className={heading}>Shipping</h3>
          <Field
            id="origin-postal-code"
            label="Ships from (postal code)"
            error={fieldError(error, "origin_postal_code")}
            hint="Shipping rates are quoted from here."
          >
            <Input
              id="origin-postal-code"
              inputMode="numeric"
              maxLength={5}
              value={form.origin_postal_code}
              onChange={(e) =>
                setForm({ ...form, origin_postal_code: e.target.value })
              }
            />
          </Field>
          <fieldset aria-describedby="couriers-hint">
            <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">
              Couriers offered
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {couriers.map((c) => (
                <label
                  key={c.code}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <Checkbox
                    checked={form.shipping_couriers.includes(c.code)}
                    onChange={(e) => toggleCourier(c.code, e.target.checked)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <p
              id="couriers-hint"
              className={
                fieldError(error, "shipping_couriers")
                  ? "mt-1.5 text-xs text-error-500"
                  : "mt-1.5 text-xs text-gray-500 dark:text-gray-400"
              }
            >
              {fieldError(error, "shipping_couriers") ??
                "Shoppers choose from these at checkout."}
            </p>
          </fieldset>
        </div>

        <div className={section}>
          <h3 className={heading}>Bank transfer</h3>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Checkbox
              checked={form.bank_transfer_enabled}
              onChange={(e) =>
                setForm({ ...form, bank_transfer_enabled: e.target.checked })
              }
            />
            Take bank transfers, confirmed by your team
          </label>
          {fieldError(error, "bank_transfer_enabled") && (
            <p className="text-xs text-error-500">
              {fieldError(error, "bank_transfer_enabled")}
            </p>
          )}
          <Field
            id="bank-instructions"
            label="Transfer instructions"
            error={fieldError(error, "bank_transfer_instructions")}
            hint="Shown to the shopper after checkout."
          >
            <Textarea
              id="bank-instructions"
              rows={3}
              value={form.bank_transfer_instructions}
              onChange={(e) =>
                setForm({ ...form, bank_transfer_instructions: e.target.value })
              }
            />
          </Field>
        </div>

        <div className={section}>
          <h3 className={heading}>Midtrans</h3>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Checkbox
              checked={form.midtrans_enabled}
              onChange={(e) =>
                setForm({ ...form, midtrans_enabled: e.target.checked })
              }
            />
            Take payments through Midtrans
          </label>
          {fieldError(error, "midtrans_enabled") && (
            <p className="text-xs text-error-500">
              {fieldError(error, "midtrans_enabled")}
            </p>
          )}
          <Field
            id="midtrans-environment"
            label="Environment"
            error={fieldError(error, "midtrans_environment")}
          >
            <Select
              id="midtrans-environment"
              value={form.midtrans_environment}
              disabled={!canSave}
              onChange={(v) =>
                setForm({
                  ...form,
                  midtrans_environment: v as Form["midtrans_environment"],
                })
              }
              options={[
                { value: "", label: "Not set" },
                { value: "sandbox", label: "Sandbox (testing)" },
                { value: "production", label: "Production" },
              ]}
            />
          </Field>
          <Field
            id="midtrans-client-key"
            label="Client key"
            error={fieldError(error, "midtrans_client_key")}
          >
            <Input
              id="midtrans-client-key"
              value={form.midtrans_client_key}
              onChange={(e) =>
                setForm({ ...form, midtrans_client_key: e.target.value })
              }
            />
          </Field>
          <Field
            id="midtrans-server-key"
            label="Server key"
            error={fieldError(error, "midtrans_server_key")}
            hint="Stored encrypted and never shown again, here or anywhere."
          >
            {replacing ? (
              <Input
                id="midtrans-server-key"
                type="password"
                autoComplete="off"
                placeholder={
                  settings.midtrans_server_key_set
                    ? "Paste the new server key"
                    : "Paste your server key"
                }
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
              />
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700">
                <span className="text-gray-800 dark:text-white/90">Set</span>
                {canSave && (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setReplacing(true)}
                  >
                    Replace
                  </Button>
                )}
              </div>
            )}
          </Field>
          <Field
            id="notification-url"
            label="Notification URL"
            hint="Midtrans is told this with every payment. Paste it into the Midtrans dashboard only if Midtrans asks for it."
          >
            <CopyField
              id="notification-url"
              label="Notification URL"
              value={settings.midtrans_notification_url}
            />
          </Field>
        </div>

        <div className={section}>
          <h3 className={heading}>Google sign-in</h3>
          <Field
            id="google-client-id"
            label="Google client ID"
            error={fieldError(error, "google_client_id")}
            hint="Your own OAuth client from Google Cloud. Empty turns Google sign-in off."
          >
            <Input
              id="google-client-id"
              value={form.google_client_id}
              onChange={(e) =>
                setForm({ ...form, google_client_id: e.target.value })
              }
            />
          </Field>
        </div>
      </fieldset>
      {error && !error.problem.errors?.length && (
        <ErrorNotice error={error} title="Could not save" />
      )}
      {canSave && (
        <div className="flex justify-end">
          <Button size="sm" type="submit" isLoading={busy}>
            Save
          </Button>
        </div>
      )}
    </form>
  )
}
