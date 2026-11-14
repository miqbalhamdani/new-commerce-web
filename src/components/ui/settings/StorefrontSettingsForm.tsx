"use client"

import { useState } from "react"

import { ImagePlus } from "lucide-react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { Card } from "@/components/ui/common/Page"
import { CopyField } from "@/components/ui/common/CopyField"
import { Dropzone } from "@/components/ui/common/Dropzone"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Checkbox, Field, Textarea } from "@/components/ui/common/Field"
import { ProgressBar } from "@/components/ui/common/ProgressBar"
import { SegmentedTabs } from "@/components/ui/common/SegmentedTabs"
import { Select } from "@/components/ui/common/Select"
import { Toggle } from "@/components/ui/common/Toggle"
import { ApiError } from "@/lib/api/client"
import type { CourierCode, ShopTheme, StorefrontSettings } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"
import { useSession } from "@/lib/auth/session"
import { uploadHero, uploadLogo, xhrPut } from "@/lib/catalog/upload"
import { formatDateTime } from "@/lib/format"
import { cx } from "@/lib/utils"

import { ColorPicker, ThemePicker } from "./ThemePicker"

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

const tabs = [
  { value: "look", label: "Website look" },
  { value: "contact", label: "Contact" },
  { value: "checkout", label: "Checkout" },
] as const
type Tab = (typeof tabs)[number]["value"]

// The fields on the first two tabs, so a refused save opens the tab holding
// the first field the API named. Everything else is on Checkout.
const lookFields = ["theme", "brand_color", "logo_r2_key", "hero_r2_key", "tagline"]
const contactFields = [
  "whatsapp_number",
  "instagram",
  "contact_email",
  "opening_hours",
  "address",
  "shopee_url",
  "tokopedia_url",
  "license",
  "cancellation_policy",
  "document_requirements",
  "rebuild_hook_url",
]

function tabOf(field: string): Tab {
  if (lookFields.includes(field)) return "look"
  if (contactFields.includes(field)) return "contact"
  return "checkout"
}

/** The tab named in the URL's hash (#checkout): a link can open it, and it
    survives the remount that follows a save. The form only renders once the
    settings have loaded, so this never runs on the server. */
function hashTab(shown: readonly { value: Tab }[]): Tab {
  const h = typeof window === "undefined" ? "" : window.location.hash.slice(1)
  return shown.find((t) => t.value === h)?.value ?? "look"
}

type Form = {
  theme: ShopTheme
  brand_color: string
  logo_r2_key: string
  hero_r2_key: string
  whatsapp_number: string
  tagline: string
  instagram: string
  address: string
  opening_hours: string
  shopee_url: string
  tokopedia_url: string
  license: string
  cancellation_policy: string
  document_requirements: string
  rebuild_hook_url: string
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
  "brand_color",
  "logo_r2_key",
  "hero_r2_key",
  "whatsapp_number",
  "tagline",
  "instagram",
  "address",
  "opening_hours",
  "shopee_url",
  "tokopedia_url",
  "license",
  "cancellation_policy",
  "document_requirements",
  "rebuild_hook_url",
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
    theme: s.theme,
    brand_color: s.brand_color ?? "",
    logo_r2_key: s.logo_r2_key ?? "",
    hero_r2_key: s.hero_r2_key ?? "",
    whatsapp_number: s.whatsapp_number ?? "",
    tagline: s.tagline ?? "",
    instagram: s.instagram ?? "",
    address: s.address ?? "",
    opening_hours: s.opening_hours ?? "",
    shopee_url: s.shopee_url ?? "",
    tokopedia_url: s.tokopedia_url ?? "",
    license: s.license ?? "",
    cancellation_policy: s.cancellation_policy ?? "",
    document_requirements: s.document_requirements ?? "",
    rebuild_hook_url: s.rebuild_hook_url ?? "",
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
 * BR-127, BR-129, BR-142, BR-143). The Midtrans server key is write-only: the
 * screen shows whether one is set and offers to replace it, and never has the
 * key to show. A new logo or hero photo uploads at once and is saved with the
 * rest. Another theme starts on its own first colour, as the API does.
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
  // Only a shop on jualan takes orders on its website, so only it sees the
  // checkout settings (BR-160, BR-161).
  const sells = useSession().tenant?.plan === "jualan"
  // An umrah shop shows its policies on every package (BR-142, BR-171).
  const umrah = useSession().tenant?.business_type === "umrah"
  const shown = sells ? tabs : tabs.filter((t) => t.value !== "checkout")
  const initial = formOf(settings)
  const [form, setForm] = useState(initial)
  const [serverKey, setServerKey] = useState("")
  const [replacing, setReplacing] = useState(!settings.midtrans_server_key_set)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [instructionsError, setInstructionsError] = useState<string>()
  const [tab, setTabState] = useState<Tab>(() => hashTab(shown))

  function setTab(t: Tab) {
    setTabState(t)
    window.history.replaceState(null, "", `#${t}`)
  }

  // Only what changed, with an emptied text field sent as null (BR-009).
  function changes(): Record<string, unknown> {
    const body: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(form) as [
      keyof Form,
      Form[keyof Form],
    ][]) {
      if (JSON.stringify(v) === JSON.stringify(initial[k])) continue
      if (!sells && tabOf(k) === "checkout") continue
      body[k] =
        (nullable as readonly string[]).includes(k) && v === "" ? null : v
    }
    if (sells && serverKey.trim()) body.midtrans_server_key = serverKey.trim()
    return body
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const body = changes()
    if (!Object.keys(body).length) return
    if (String(body.bank_transfer_instructions ?? "").includes("xxx")) {
      setInstructionsError("Replace the xxx parts with your bank details.")
      setTab("checkout")
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
      const e = asApiError(err)
      setError(e)
      const field = e.problem.errors?.[0]?.field
      if (field) setTab(tabOf(field))
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

  // Tabbed so each tab fits about one window. Fields pair up two to
  // a row with the hint under the control, so paired controls line up. A
  // payment method's fields are a tinted block under its toggle.
  const pad = "p-5 sm:p-6"
  const pairs = "grid gap-5 sm:grid-cols-2"
  const sectionTitle = "mb-3 text-xs uppercase leading-5 text-gray-400"
  const sectionCard = "divide-y divide-gray-100 dark:divide-gray-800"
  const subRow = cx(pad, "bg-gray-50/60 dark:bg-white/[0.02]")
  // Sample keys in Midtrans' own shape; sandbox keys carry an SB- prefix.
  const keyPrefix = form.midtrans_environment === "production" ? "" : "SB-"
  const dirty = canSave && Object.keys(changes()).length > 0

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      {/* Outside the fieldset, so a viewer can still look through every tab.
          All three stay mounted: switching keeps what was typed or uploaded,
          and one Save sends the lot. */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <SegmentedTabs
          variant="underline"
          label="Storefront settings"
          options={shown}
          value={tab}
          onChange={setTab}
        />
      </div>
      <fieldset disabled={!canSave} className="min-w-0">
        <div hidden={tab !== "look"}>
          <Card className={sectionCard}>
            <div className={pad}>
              <p className={labelText}>Theme</p>
              <p className={hintText}>
                How your website is laid out. Each is made for a kind of shop,
                but any shop can use any theme.
              </p>
              <div className="mt-4">
                <ThemePicker
                  value={form.theme}
                  disabled={!canSave}
                  onChange={(theme) =>
                    setForm({ ...form, theme, brand_color: "" })
                  }
                />
              </div>
              {fieldError(error, "theme") && (
                <p className="mt-1.5 text-xs text-error-500">
                  {fieldError(error, "theme")}
                </p>
              )}
            </div>
            <div className={cx(pad, pairs)}>
              <Field
                id="brand-color"
                label="Colour"
                hint="Buttons, links and accents. Each theme has four, made for it."
                error={fieldError(error, "brand_color")}
              >
                <ColorPicker
                  theme={form.theme}
                  value={form.brand_color}
                  disabled={!canSave}
                  onChange={(brand_color) => setForm({ ...form, brand_color })}
                />
              </Field>
              <Field
                id="tagline"
                label="Tagline"
                hint="Under your shop name on the website. Up to 160 characters."
                error={fieldError(error, "tagline")}
              >
                <Input
                  id="tagline"
                  maxLength={160}
                  value={form.tagline}
                  onChange={(e) =>
                    setForm({ ...form, tagline: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className={cx(pad, pairs)}>
              <ShopImage
                id="logo"
                name="logo"
                label="Logo"
                hint="JPEG, PNG or WebP up to 2 MB. Without one, the website shows your shop name."
                url={form.logo_r2_key ? settings.logo_url : null}
                canSave={canSave}
                error={fieldError(error, "logo_r2_key")}
                upload={(file, onProgress) =>
                  uploadLogo(api, file, xhrPut, onProgress)
                }
                onChange={(logo_r2_key) =>
                  setForm((f) => ({ ...f, logo_r2_key }))
                }
                preview="h-16 max-w-48 object-contain p-1"
              />
              <ShopImage
                id="hero"
                name="hero photo"
                label="Hero photo"
                hint="The big photo at the top of your home page. JPEG, PNG or WebP up to 5 MB. Without one, the website uses your newest product's photo."
                url={form.hero_r2_key ? settings.hero_url : null}
                canSave={canSave}
                error={fieldError(error, "hero_r2_key")}
                upload={(file, onProgress) =>
                  uploadHero(api, file, xhrPut, onProgress)
                }
                onChange={(hero_r2_key) =>
                  setForm((f) => ({ ...f, hero_r2_key }))
                }
                preview="aspect-[16/9] w-64 object-cover"
              />
            </div>
          </Card>
        </div>

        <div hidden={tab !== "contact"}>
          <Card className={cx(pad, pairs)}>
            <Field
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
            </Field>
            <Field
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
            </Field>
            <Field
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
            </Field>
            <Field
              id="opening-hours"
              label="Opening hours"
              hint="When you reply or open the shop, such as Setiap hari 09.00–21.00."
              error={fieldError(error, "opening_hours")}
            >
              <Input
                id="opening-hours"
                maxLength={120}
                value={form.opening_hours}
                onChange={(e) =>
                  setForm({ ...form, opening_hours: e.target.value })
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                id="address"
                label="Address"
                hint="Shown on your website with a map. Leave empty if you sell online only."
                error={fieldError(error, "address")}
              >
                <Textarea
                  id="address"
                  rows={2}
                  maxLength={300}
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field
              id="shopee-url"
              label="Shopee"
              hint="Your shop's link, such as https://shopee.co.id/tokoabc."
              error={fieldError(error, "shopee_url")}
            >
              <Input
                id="shopee-url"
                type="url"
                placeholder="https://shopee.co.id/tokoabc"
                value={form.shopee_url}
                onChange={(e) =>
                  setForm({ ...form, shopee_url: e.target.value.trim() })
                }
              />
            </Field>
            <Field
              id="tokopedia-url"
              label="Tokopedia"
              hint="Your shop's link, such as https://www.tokopedia.com/tokoabc."
              error={fieldError(error, "tokopedia_url")}
            >
              <Input
                id="tokopedia-url"
                type="url"
                placeholder="https://www.tokopedia.com/tokoabc"
                value={form.tokopedia_url}
                onChange={(e) =>
                  setForm({ ...form, tokopedia_url: e.target.value.trim() })
                }
              />
            </Field>
            <Field
              id="license"
              label="Business licence"
              hint="Shown on your website, such as PPIU No. U.133 Tahun 2020."
              error={fieldError(error, "license")}
            >
              <Input
                id="license"
                maxLength={120}
                value={form.license}
                onChange={(e) => setForm({ ...form, license: e.target.value })}
              />
            </Field>
            <Field
              id="rebuild-hook-url"
              label="Rebuild hook"
              hint={
                settings.rebuild_last_at
                  ? `Last called ${formatDateTime(settings.rebuild_last_at)}${settings.rebuild_last_status ? ` (HTTP ${settings.rebuild_last_status})` : ", no answer"}.`
                  : "For a website built ahead of time: paste its Vercel, Cloudflare Pages or Netlify deploy hook, and it is rebuilt about a minute after you change something."
              }
              error={fieldError(error, "rebuild_hook_url")}
            >
              <Input
                id="rebuild-hook-url"
                type="url"
                placeholder="https://api.vercel.com/v1/integrations/deploy/…"
                value={form.rebuild_hook_url}
                onChange={(e) =>
                  setForm({ ...form, rebuild_hook_url: e.target.value.trim() })
                }
              />
            </Field>
            {umrah && (
              <>
                <div className="sm:col-span-2">
                  <Field
                    id="cancellation-policy"
                    label="Cancellation policy"
                    hint="Shown on every package that has none of its own."
                    error={fieldError(error, "cancellation_policy")}
                  >
                    <Textarea
                      id="cancellation-policy"
                      rows={4}
                      maxLength={3000}
                      value={form.cancellation_policy}
                      onChange={(e) =>
                        setForm({ ...form, cancellation_policy: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field
                    id="document-requirements"
                    label="Document requirements"
                    hint="What pilgrims bring, such as passport, ID card and meningitis vaccine. Empty shows a standard list."
                    error={fieldError(error, "document_requirements")}
                  >
                    <Textarea
                      id="document-requirements"
                      rows={4}
                      maxLength={3000}
                      value={form.document_requirements}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          document_requirements: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </>
            )}
          </Card>
        </div>

        <div hidden={!sells || tab !== "checkout"}>
          <div className="flex flex-col gap-6">
            <section>
              <h3 className={sectionTitle}>Shipping</h3>
              <Card className={cx(pad, "grid gap-5 sm:grid-cols-3")}>
                <Field
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
                </Field>
                <fieldset className="min-w-0 sm:col-span-2">
                  <legend className="float-left mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
                    Couriers
                  </legend>
                  <div className="clear-left grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3">
                    {couriers.map((c) => (
                      <label
                        key={c.code}
                        className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <Checkbox
                          checked={form.shipping_couriers.includes(c.code)}
                          onChange={(e) =>
                            toggleCourier(c.code, e.target.checked)
                          }
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  <p
                    className={cx(
                      "mt-2.5 text-xs",
                      fieldError(error, "shipping_couriers")
                        ? "text-error-500"
                        : "text-gray-500 dark:text-gray-400",
                    )}
                  >
                    {fieldError(error, "shipping_couriers") ??
                      "Offered at checkout."}
                  </p>
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
                  onChange={(on) =>
                    setForm({ ...form, bank_transfer_enabled: on })
                  }
                />
                {form.bank_transfer_enabled && (
                  <div className={subRow}>
                    <Field
                      id="bank-instructions"
                      label="Transfer instructions"
                      hint="Shown after checkout."
                      error={
                        instructionsError ??
                        fieldError(error, "bank_transfer_instructions")
                      }
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
                    </Field>
                  </div>
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
                  <div className={cx(subRow, pairs)}>
                    <Field
                      id="midtrans-environment"
                      label="Environment"
                      error={fieldError(error, "midtrans_environment")}
                    >
                      <Select
                        id="midtrans-environment"
                        className="w-full"
                        value={form.midtrans_environment}
                        disabled={!canSave}
                        onChange={(v) =>
                          setForm({
                            ...form,
                            midtrans_environment:
                              v as Form["midtrans_environment"],
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
                        placeholder={`${keyPrefix}Mid-client-xxxxxxxxxxxxxxxx`}
                        value={form.midtrans_client_key}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            midtrans_client_key: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field
                      id="midtrans-server-key"
                      label="Server key"
                      hint="Encrypted, never shown again."
                      error={fieldError(error, "midtrans_server_key")}
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
                    </Field>
                    <Field
                      id="notification-url"
                      label="Notification URL"
                      hint="Paste into Midtrans only if asked."
                    >
                      <CopyField
                        id="notification-url"
                        label="Notification URL"
                        value={settings.midtrans_notification_url}
                      />
                    </Field>
                  </div>
                )}
              </Card>
            </section>

            <section>
              <h3 className={sectionTitle}>Customer sign-in</h3>
              <Card className={cx(pad, pairs)}>
                <Field
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
                </Field>
              </Card>
            </section>
          </div>
        </div>
      </fieldset>
      {error && !error.problem.errors?.length && (
        <ErrorNotice error={error} title="Could not save" />
      )}
      {/* Once something changed, Save floats at the foot of the window, in
          reach whichever tab is open; until then it sits under the form. */}
      {canSave && (
        <div
          className={cx(
            "flex items-center justify-end gap-4",
            dirty &&
              "sticky bottom-4 z-10 rounded-2xl border border-gray-200 bg-white/95 px-5 py-3 shadow-theme-md backdrop-blur dark:border-gray-800 dark:bg-gray-900/95",
          )}
        >
          {dirty && (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              Unsaved changes
            </p>
          )}
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

/** The logo or the hero photo: a preview with Remove, or a drop zone that
    uploads at once (BR-142). The key is saved with the rest of the form. */
function ShopImage({
  id,
  name,
  label,
  hint,
  url,
  canSave,
  error,
  upload,
  onChange,
  preview,
}: {
  id: string
  name: string
  label: string
  hint: string
  url: string | null
  canSave: boolean
  error?: string
  upload: (
    file: File,
    onProgress: (f: number) => void,
  ) => Promise<{ key: string; url: string }>
  onChange: (key: string) => void
  preview: string
}) {
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string>()
  const shown = uploaded ?? url

  async function pick(files: File[]) {
    const file = files[0]
    if (!file) return
    setUploadError(undefined)
    setProgress(0)
    try {
      const done = await upload(file, setProgress)
      setUploaded(done.url)
      onChange(done.key)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setProgress(null)
    }
  }

  return (
    <Field id={id} label={label} hint={hint} error={uploadError ?? error}>
      {shown ? (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- the image domain is the shop's, not a Next loader's */}
          <img
            src={shown}
            alt={label}
            className={cx("rounded-lg border border-gray-200 dark:border-gray-800", preview)}
          />
          {canSave && (
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => {
                setUploaded(null)
                onChange("")
              }}
            >
              Remove {name}
            </Button>
          )}
        </div>
      ) : canSave ? (
        <Dropzone
          accept="image/jpeg,image/png,image/webp"
          onFiles={pick}
          className="p-5"
        >
          <ImagePlus className="size-6" aria-hidden />
          <p>Drop a {name}, or</p>
        </Dropzone>
      ) : (
        <p className="text-sm text-gray-500">No {name}.</p>
      )}
      {progress !== null && (
        <ProgressBar
          value={progress}
          max={1}
          label={`Uploading the ${name}`}
          className="mt-3"
        />
      )}
    </Field>
  )
}
