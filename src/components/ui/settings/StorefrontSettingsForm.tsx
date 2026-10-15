"use client"

import { Switch } from "@headlessui/react"
import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Card } from "@/components/ui/common/Page"
import { CopyField } from "@/components/ui/common/CopyField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Checkbox, Textarea } from "@/components/ui/common/Field"
import { Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { CourierCode, StorefrontSettings } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"
import { cx } from "@/lib/utils"

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

// Prefilled when the shop has none; the xxx parts are the owner's to fill,
// and save refuses to send them to shoppers as is.
const defaultInstructions = `Transfer the order total to:
Bank: xxx
Account number: xxx
Account name: xxx

Put your order number in the transfer note. We confirm your order once the payment arrives.`

function formOf(s: StorefrontSettings): Form {
  return {
    contact_email: s.contact_email ?? "",
    google_client_id: s.google_client_id ?? "",
    origin_postal_code: s.origin_postal_code ?? "",
    shipping_couriers: s.shipping_couriers,
    bank_transfer_enabled: s.bank_transfer_enabled,
    bank_transfer_instructions:
      s.bank_transfer_instructions ?? defaultInstructions,
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
  const [instructionsError, setInstructionsError] = useState<string>()

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
    if (String(body.bank_transfer_instructions ?? "").includes("xxx")) {
      setInstructionsError("Replace the xxx parts with your bank details.")
      return
    }
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

  // Reference-style sections: an uppercase label above a card whose rows are
  // split by full-width dividers. A payment method's fields are extra rows
  // under its toggle, tinted so they read as belonging to it.
  const sectionTitle = "mb-3 text-xs uppercase leading-5 text-gray-400"
  const sectionCard = "divide-y divide-gray-100 dark:divide-gray-800"
  const subRow = "bg-gray-50/60 dark:bg-white/[0.02]"
  // Sample keys in Midtrans' own shape; sandbox keys carry an SB- prefix.
  const keyPrefix = form.midtrans_environment === "production" ? "" : "SB-"

  return (
    <form onSubmit={save} className="flex flex-col gap-7">
      <fieldset disabled={!canSave} className="flex flex-col gap-7">
        <section>
          <h3 className={sectionTitle}>General</h3>
          <Card className={sectionCard}>
            <Row
              id="contact-email"
              label="Contact email"
              hint="Where customer replies go."
              error={fieldError(error, "contact_email")}
            >
              <Input
                id="contact-email"
                type="email"
                value={form.contact_email}
                onChange={(e) =>
                  setForm({ ...form, contact_email: e.target.value })
                }
              />
            </Row>
            <Row
              id="google-client-id"
              label="Google client ID"
              hint="Leave empty to turn off Google sign-in."
              error={fieldError(error, "google_client_id")}
            >
              <Input
                id="google-client-id"
                value={form.google_client_id}
                onChange={(e) =>
                  setForm({ ...form, google_client_id: e.target.value })
                }
              />
            </Row>
          </Card>
        </section>

        <section>
          <h3 className={sectionTitle}>Shipping</h3>
          <Card className={sectionCard}>
            <Row
              id="origin-postal-code"
              label="Ships from (postal code)"
              hint="Rates are quoted from here."
              error={fieldError(error, "origin_postal_code")}
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
            </Row>
            <fieldset className="px-5 py-4 sm:px-6">
              <legend className="float-left text-sm font-medium text-gray-800 dark:text-white/90">
                Couriers
              </legend>
              <p
                className={cx(
                  "clear-left mt-0.5 text-xs",
                  fieldError(error, "shipping_couriers")
                    ? "text-error-500"
                    : "text-gray-500 dark:text-gray-400",
                )}
              >
                {fieldError(error, "shipping_couriers") ??
                  "Offered at checkout."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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
            </fieldset>
          </Card>
        </section>

        <section>
          <h3 className={sectionTitle}>Payments</h3>
          <Card className={sectionCard}>
            {/* A method's fields only show while it is on. Switching off
                hides them without clearing, so a save sends only the
                enabled flag (BR-009). */}
            <ToggleRow
              label="Bank transfer"
              hint="Confirmed by your team."
              checked={form.bank_transfer_enabled}
              disabled={!canSave}
              error={fieldError(error, "bank_transfer_enabled")}
              onChange={(on) => setForm({ ...form, bank_transfer_enabled: on })}
            />
            {form.bank_transfer_enabled && (
              <Row
                id="bank-instructions"
                label="Transfer instructions"
                hint="Shown after checkout."
                error={
                  instructionsError ??
                  fieldError(error, "bank_transfer_instructions")
                }
                className={subRow}
                stacked
              >
                <Textarea
                  id="bank-instructions"
                  rows={6}
                  hasError={!!instructionsError}
                  value={form.bank_transfer_instructions}
                  onChange={(e) => {
                    setInstructionsError(undefined)
                    setForm({
                      ...form,
                      bank_transfer_instructions: e.target.value,
                    })
                  }}
                />
              </Row>
            )}

            <ToggleRow
              label="Midtrans"
              hint="Online payments."
              checked={form.midtrans_enabled}
              disabled={!canSave}
              error={fieldError(error, "midtrans_enabled")}
              onChange={(on) => setForm({ ...form, midtrans_enabled: on })}
            />
            {form.midtrans_enabled && (
              <>
                <Row
                  id="midtrans-environment"
                  label="Environment"
                  error={fieldError(error, "midtrans_environment")}
                  className={subRow}
                >
                  <Select
                    id="midtrans-environment"
                    className="w-full"
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
                </Row>
                <Row
                  id="midtrans-client-key"
                  label="Client key"
                  error={fieldError(error, "midtrans_client_key")}
                  className={subRow}
                >
                  <Input
                    id="midtrans-client-key"
                    placeholder={`${keyPrefix}Mid-client-xxxxxxxxxxxxxxxx`}
                    value={form.midtrans_client_key}
                    onChange={(e) =>
                      setForm({ ...form, midtrans_client_key: e.target.value })
                    }
                  />
                </Row>
                <Row
                  id="midtrans-server-key"
                  label="Server key"
                  hint="Encrypted, never shown again."
                  error={fieldError(error, "midtrans_server_key")}
                  className={subRow}
                >
                  {replacing ? (
                    <Input
                      id="midtrans-server-key"
                      type="password"
                      autoComplete="off"
                      placeholder={`${keyPrefix}Mid-server-xxxxxxxx…`}
                      value={serverKey}
                      onChange={(e) => setServerKey(e.target.value)}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                      <span className="text-gray-800 dark:text-white/90">
                        Set
                      </span>
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
                </Row>
                <Row
                  id="notification-url"
                  label="Notification URL"
                  hint="Paste into Midtrans only if asked."
                  className={subRow}
                >
                  <CopyField
                    id="notification-url"
                    label="Notification URL"
                    value={settings.midtrans_notification_url}
                  />
                </Row>
              </>
            )}
          </Card>
        </section>
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

const rowPad = "px-5 py-4 sm:px-6"
const labelText = "text-sm font-medium text-gray-800 dark:text-white/90"
const hintText = "mt-0.5 text-xs text-gray-500 dark:text-gray-400"

/** One settings row: label and hint on the left, the control on the right
    (stacked on mobile, or always with `stacked` for wide controls). An error
    sits under the control, as in Field. */
function Row({
  id,
  label,
  hint,
  error,
  stacked,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  stacked?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cx(
        rowPad,
        "grid gap-3",
        !stacked && "sm:grid-cols-2 sm:items-center sm:gap-6",
        className,
      )}
    >
      <div>
        <label htmlFor={id} className={labelText}>
          {label}
        </label>
        {hint && <p className={hintText}>{hint}</p>}
      </div>
      <div>
        {children}
        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-xs text-error-500">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

/** A row that switches a payment method on or off. Headless UI's Switch is
    not a native input, so the disabled fieldset does not reach it. */
function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  error,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  error?: string
  onChange: (on: boolean) => void
}) {
  return (
    <div className={cx(rowPad, "flex items-center justify-between gap-4")}>
      <div>
        <p className={labelText}>{label}</p>
        <p className={hintText}>{hint}</p>
        {error && <p className="mt-1.5 text-xs text-error-500">{error}</p>}
      </div>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className={cx(
          "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-gray-200 transition-colors dark:bg-white/10",
          "data-[checked]:bg-brand-500 dark:data-[checked]:bg-brand-500",
          "focus:outline-none data-[focus]:ring-2 data-[focus]:ring-brand-500/30",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none mt-0.5 size-5 translate-x-0.5 rounded-full bg-white shadow-theme-xs transition-transform group-data-[checked]:translate-x-[1.375rem]"
        />
      </Switch>
    </div>
  )
}
