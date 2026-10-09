"use client"

import { useState } from "react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import { ErrorNotice } from "@/components/ui/common/ErrorNotice"
import { Field } from "@/components/ui/common/Field"
import { Select } from "@/components/ui/common/Select"
import { ApiError } from "@/lib/api/client"
import type { Settings } from "@/lib/api/types"
import { asApiError, fieldError, useApi } from "@/lib/api/use-api"

/** Indonesia's three zones; the wire stays WIB whatever is chosen (BR-007). */
export const timezones = [
  { value: "Asia/Jakarta", label: "WIB — Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA — Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT — Asia/Jayapura" },
]

/**
 * The shop's name, display time zone and order prefix (BR-029, BR-077).
 * canSave is false for anyone but the owner, who then sees the values and
 * no save control (BR-025).
 */
export function SettingsForm({
  settings,
  canSave,
  onSaved,
  submitLabel = "Save",
}: {
  settings: Settings
  canSave: boolean
  onSaved: (s: Settings) => void
  submitLabel?: string
}) {
  const api = useApi()
  const [form, setForm] = useState({
    name: settings.name,
    timezone: settings.timezone,
    order_prefix: settings.order_prefix,
  })
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const changed = Object.fromEntries(
    Object.entries(form).filter(
      ([k, v]) => v !== settings[k as keyof typeof form],
    ),
  )

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const s = Object.keys(changed).length
        ? await api<Settings>("/v1/settings", {
            method: "PATCH",
            body: changed,
          })
        : settings
      setError(null)
      onSaved(s)
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const zones = timezones.some((z) => z.value === form.timezone)
    ? timezones
    : [...timezones, { value: form.timezone, label: form.timezone }]

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <fieldset disabled={!canSave} className="flex flex-col gap-4">
        <Field
          id="shop-name"
          label="Shop name"
          error={fieldError(error, "name")}
          hint="Shown to your team and in the From of the emails your shop sends."
        >
          <Input
            id="shop-name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field
          id="timezone"
          label="Time zone"
          error={fieldError(error, "timezone")}
          hint="For showing times in the admin."
        >
          <Select
            id="timezone"
            value={form.timezone}
            onChange={(v) => setForm({ ...form, timezone: v })}
            options={zones}
            error={Boolean(fieldError(error, "timezone"))}
          />
        </Field>
        <Field
          id="order-prefix"
          label="Order number prefix"
          error={fieldError(error, "order_prefix")}
          hint={`Orders are numbered ${form.order_prefix || "ERG"}-000123. 2 to 6 capital letters or digits.`}
        >
          <Input
            id="order-prefix"
            required
            maxLength={6}
            value={form.order_prefix}
            onChange={(e) =>
              setForm({ ...form, order_prefix: e.target.value.toUpperCase() })
            }
          />
        </Field>
        {form.order_prefix !== settings.order_prefix && (
          <p
            role="status"
            className="text-xs text-warning-600 dark:text-orange-400"
          >
            The new prefix applies to new orders only; existing order numbers
            keep {settings.order_prefix}.
          </p>
        )}
      </fieldset>
      {error && !error.problem.errors?.length && (
        <ErrorNotice error={error} title="Could not save" />
      )}
      {canSave && (
        <div className="flex justify-end">
          <Button size="sm" type="submit" isLoading={busy}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}
