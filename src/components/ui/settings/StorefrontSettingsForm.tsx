"use client"

import { useState } from "react"

import { ImagePlus } from "lucide-react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Card } from "@/components/ui/common/Page"
import { CopyField } from "@/components/ui/common/CopyField"
import { Dropzone } from "@/components/ui/common/Dropzone"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Checkbox, Textarea } from "@/components/ui/common/Field"
import { ProgressBar } from "@/components/ui/common/ProgressBar"
import { Select } from "@/components/ui/common/Select"
import { Toggle } from "@/components/ui/common/Toggle"
import { ApiError } from "@/lib/api/client"
import type { CourierCode, StorefrontSettings } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"
import { uploadLogo, xhrPut } from "@/lib/catalog/upload"
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
  logo_r2_key: string
  whatsapp_number: string
  tagline: string
  brand_color: string
  instagram: string
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
  "logo_r2_key",
  "whatsapp_number",
  "tagline",
  "brand_color",
  "instagram",
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
    logo_r2_key: s.logo_r2_key ?? "",
    whatsapp_number: s.whatsapp_number ?? "",
    tagline: s.tagline ?? "",
    brand_color: s.brand_color ?? "",
    instagram: s.instagram ?? "",
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
 * How the shop's website looks and sells (04-api-spec.md §4; BR-120, BR-122,
 * BR-127, BR-129, BR-142). The Midtrans server key is write-only: the screen
 * shows whether one is set and offers to replace it, and never has the key
 * to show. A new logo uploads at once and is saved with the rest.
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
  const [logoURL, setLogoURL] = useState(settings.logo_url)
  const [logoProgress, setLogoProgress] = useState<number | null>(null)
  const [logoError, setLogoError] = useState<string>()

  async function pickLogo(files: File[]) {
    const file = files[0]
    if (!file) return
    setLogoError(undefined)
    setLogoProgress(0)
    try {
      const { key, url } = await uploadLogo(api, file, xhrPut, setLogoProgress)
      setForm((f) => ({ ...f, logo_r2_key: key }))
      setLogoURL(url)
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setLogoProgress(null)
    }
  }

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
          <h3 className={sectionTitle}>Website look</h3>
          <Card className={sectionCard}>
            <Row
              id="logo"
              label="Logo"
              hint="JPEG, PNG or WebP up to 2 MB. Without one, the website shows your shop name."
              error={logoError ?? fieldError(error, "logo_r2_key")}
              stacked
            >
              {form.logo_r2_key && logoURL ? (
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the image domain is the shop's, not a Next loader's */}
                  <img
                    src={logoURL}
                    alt="Logo"
                    className="h-16 max-w-48 rounded-lg border border-gray-200 object-contain p-1 dark:border-gray-800"
                  />
                  {canSave && (
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => setForm({ ...form, logo_r2_key: "" })}
                    >
                      Remove logo
                    </Button>
                  )}
                </div>
              ) : canSave ? (
                <Dropzone
                  accept="image/jpeg,image/png,image/webp"
                  onFiles={pickLogo}
                >
                  <ImagePlus className="size-6" aria-hidden />
                  <p>Drop a logo, or</p>
                </Dropzone>
              ) : (
                <p className="text-sm text-gray-500">No logo.</p>
              )}
              {logoProgress !== null && (
                <ProgressBar
                  value={logoProgress}
                  max={1}
                  label="Uploading the logo"
                  className="mt-3"
                />
              )}
            </Row>
            <Row
              id="tagline"
              label="Tagline"
              hint="Under your shop name on the website. Up to 160 characters."
              error={fieldError(error, "tagline")}
            >
              <Input
                id="tagline"
                maxLength={160}
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              />
            </Row>
            <Row
              id="whatsapp-number"
              label="WhatsApp number"
              hint="Where the order button sends shoppers. Starts with 62."
              error={fieldError(error, "whatsapp_number")}
            >
              <Input
                id="whatsapp-number"
                inputMode="numeric"
                placeholder="6281234567890"
                value={form.whatsapp_number}
                onChange={(e) =>
                  setForm({
                    ...form,
                    whatsapp_number: e.target.value.replace(/\D/g, ""),
                  })
                }
              />
            </Row>
            <Row
              id="brand-color"
              label="Brand colour"
              hint="Buttons and links on the website."
              error={fieldError(error, "brand_color")}
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick the brand colour"
                  value={form.brand_color || "#465fff"}
                  onChange={(e) =>
                    setForm({ ...form, brand_color: e.target.value })
                  }
                  className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-transparent p-1 dark:border-gray-700"
                />
                <Input
                  id="brand-color"
                  placeholder="#465fff"
                  maxLength={7}
                  value={form.brand_color}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      brand_color: e.target.value.trim().toLowerCase(),
                    })
                  }
                />
              </div>
            </Row>
            <Row
              id="instagram"
              label="Instagram"
              hint="Your handle, linked in the website's footer."
              error={fieldError(error, "instagram")}
            >
              <Input
                id="instagram"
                placeholder="tokoabc"
                value={form.instagram}
                onChange={(e) =>
                  setForm({
                    ...form,
                    instagram: e.target.value.trim().replace(/^@/, ""),
                  })
                }
              />
            </Row>
          </Card>
        </section>

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
      <Toggle label={label} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}
