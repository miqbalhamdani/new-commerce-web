"use client"

import { ArrowDown, ArrowUp, X } from "lucide-react"

import Button from "@/components/ui/button/Button"
import Input from "@/components/form/input/InputField"
import type { ProductForm } from "@/components/ui/catalog/ProductDetails"
import { Field, Textarea } from "@/components/ui/common/Field"
import { Section } from "@/components/ui/common/Page"
import { fieldError } from "@/lib/api/use-api"
import {
  move,
  type DayDraft,
  type HotelDraft,
  type PackageDraft,
} from "@/lib/catalog/package"

/**
 * An umrah shop's package details (P1-941, BR-171), as cards in the product
 * editor's main column. They share the product form's state and its Save; the
 * API names a broken field as package.{field}.
 */
export function PackageFields({
  form,
  canWrite,
}: {
  form: ProductForm
  canWrite: boolean
}) {
  const pkg = form.draft.package
  if (!pkg) return null
  const set = (p: Partial<PackageDraft>) =>
    form.set({ package: { ...pkg, ...p } })
  const err = (field: string) => fieldError(form.error, `package.${field}`)
  const text = (field: keyof PackageDraft) => ({
    id: `package-${field}`,
    value: pkg[field] as string,
    error: Boolean(err(field)),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set({ [field]: e.target.value }),
  })

  return (
    <>
      <Section
        id="schedule"
        title="Schedule and seats"
        description="A date once the departure is fixed, or a month until then. Seats left is what pilgrims see; update it as bookings come in."
      >
        <fieldset disabled={!canWrite} className="grid gap-5 sm:grid-cols-2">
          <Field
            id="package-departure_date"
            label="Departure date"
            error={err("departure_date") ?? err("departure")}
          >
            <Input type="date" {...text("departure_date")} />
          </Field>
          <Field
            id="package-departure_text"
            label="Or departure month"
            error={err("departure_text")}
            hint="Such as Desember 2026"
          >
            <Input placeholder="Desember 2026" {...text("departure_text")} />
          </Field>
          <Field
            id="package-return_date"
            label="Return date"
            error={err("return_date")}
          >
            <Input type="date" {...text("return_date")} />
          </Field>
          <Field
            id="package-duration_days"
            label="Duration (days)"
            error={err("duration_days")}
          >
            <Input inputMode="numeric" {...text("duration_days")} />
          </Field>
          <Field
            id="package-seats_left"
            label="Seats left"
            error={err("seats_left")}
            hint="0 shows the package as full."
          >
            <Input inputMode="numeric" {...text("seats_left")} />
          </Field>
          <Field
            id="package-seats_total"
            label="Seats in all"
            error={err("seats_total")}
          >
            <Input inputMode="numeric" {...text("seats_total")} />
          </Field>
        </fieldset>
      </Section>

      <Section id="flight" title="Flight">
        <fieldset disabled={!canWrite} className="grid gap-5 sm:grid-cols-2">
          <Field id="package-airline" label="Airline" error={err("airline")}>
            <Input placeholder="Saudia" {...text("airline")} />
          </Field>
          <Field id="package-route" label="Route" error={err("route")}>
            <Input placeholder="CGK–MED / JED–CGK" {...text("route")} />
          </Field>
        </fieldset>
      </Section>

      <Section
        id="hotels"
        title="Hotels"
        description="Leave For empty when every room choice stays there; type a choice, such as Promo, for a hotel only it uses."
      >
        <fieldset disabled={!canWrite} className="flex flex-col gap-3">
          {pkg.hotels.map((h, i) => {
            const setHotel = (p: Partial<HotelDraft>) =>
              set({
                hotels: pkg.hotels.map((x, j) =>
                  j === i ? { ...x, ...p } : x,
                ),
              })
            const at = (f: string) => err(`hotels.${i}.${f}`)
            return (
              <div
                key={i}
                className="grid gap-2 sm:grid-cols-[1fr_2fr_5rem_5rem_1fr_auto]"
              >
                <Input
                  aria-label={`Hotel ${i + 1} city`}
                  placeholder="Makkah"
                  value={h.city}
                  error={Boolean(at("city"))}
                  onChange={(e) => setHotel({ city: e.target.value })}
                />
                <Input
                  aria-label={`Hotel ${i + 1} name`}
                  placeholder="Hotel name"
                  value={h.name}
                  error={Boolean(at("name"))}
                  onChange={(e) => setHotel({ name: e.target.value })}
                />
                <Input
                  aria-label={`Hotel ${i + 1} stars`}
                  placeholder="★"
                  inputMode="numeric"
                  value={h.stars}
                  error={Boolean(at("stars"))}
                  onChange={(e) => setHotel({ stars: e.target.value })}
                />
                <Input
                  aria-label={`Hotel ${i + 1} nights`}
                  placeholder="Nights"
                  inputMode="numeric"
                  value={h.nights}
                  error={Boolean(at("nights"))}
                  onChange={(e) => setHotel({ nights: e.target.value })}
                />
                <Input
                  aria-label={`Hotel ${i + 1} for`}
                  placeholder="For: all"
                  value={h.variant}
                  onChange={(e) => setHotel({ variant: e.target.value })}
                />
                {canWrite && (
                  <RemoveButton
                    label={`Remove hotel ${i + 1}`}
                    onClick={() =>
                      set({ hotels: pkg.hotels.filter((_, j) => j !== i) })
                    }
                  />
                )}
              </div>
            )
          })}
          {canWrite && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="self-start"
              onClick={() =>
                set({
                  hotels: [
                    ...pkg.hotels,
                    { city: "", name: "", stars: "", nights: "", variant: "" },
                  ],
                })
              }
            >
              Add hotel
            </Button>
          )}
        </fieldset>
      </Section>

      <Section
        id="itinerary"
        title="Itinerary"
        description="One entry per day, in order: the day number follows its place."
      >
        <fieldset disabled={!canWrite} className="flex flex-col gap-4">
          {pkg.itinerary.map((d, i) => {
            const setDay = (p: Partial<DayDraft>) =>
              set({
                itinerary: pkg.itinerary.map((x, j) =>
                  j === i ? { ...x, ...p } : x,
                ),
              })
            return (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
              >
                <span className="mt-2.5 w-14 shrink-0 text-theme-sm font-medium text-gray-500 dark:text-gray-400">
                  Day {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input
                    aria-label={`Day ${i + 1} title`}
                    placeholder="Jakarta – Madinah"
                    value={d.title}
                    error={Boolean(err(`itinerary.${i}.title`))}
                    onChange={(e) => setDay({ title: e.target.value })}
                  />
                  <Textarea
                    aria-label={`Day ${i + 1} plan`}
                    rows={2}
                    placeholder="What happens this day"
                    value={d.text}
                    onChange={(e) => setDay({ text: e.target.value })}
                  />
                </div>
                {canWrite && (
                  <div className="flex shrink-0 flex-col">
                    <IconButton
                      label={`Move day ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() =>
                        set({ itinerary: move(pkg.itinerary, i, -1) })
                      }
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Move day ${i + 1} down`}
                      disabled={i === pkg.itinerary.length - 1}
                      onClick={() =>
                        set({ itinerary: move(pkg.itinerary, i, 1) })
                      }
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </IconButton>
                    <RemoveButton
                      label={`Remove day ${i + 1}`}
                      onClick={() =>
                        set({
                          itinerary: pkg.itinerary.filter((_, j) => j !== i),
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )
          })}
          {canWrite && (
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="self-start"
              onClick={() =>
                set({ itinerary: [...pkg.itinerary, { title: "", text: "" }] })
              }
            >
              Add day
            </Button>
          )}
        </fieldset>
      </Section>

      <Section
        id="inclusions"
        title="Included, not included and bonus"
        description="One entry per line item, such as Visa umrah or Koper."
      >
        <fieldset disabled={!canWrite} className="grid gap-6 lg:grid-cols-3">
          {(
            [
              ["includes", "Included"],
              ["excludes", "Not included"],
              ["bonus", "Bonus"],
            ] as const
          ).map(([field, label]) => (
            <ListField
              key={field}
              label={label}
              items={pkg[field]}
              canWrite={canWrite}
              error={pkg[field]
                .map((_, i) => err(`${field}.${i}`))
                .find(Boolean)}
              onChange={(items) => set({ [field]: items })}
            />
          ))}
        </fieldset>
      </Section>

      <Section id="notes" title="Price note and cancellation">
        <fieldset disabled={!canWrite} className="flex flex-col gap-5">
          <Field
            id="package-price_note"
            label="Price note"
            error={err("price_note")}
            hint="Shown under the price, such as Harga per orang, kamar Quad."
          >
            <Input {...text("price_note")} />
          </Field>
          <Field
            id="package-cancellation_policy"
            label="Cancellation policy for this package"
            error={err("cancellation_policy")}
            hint="Leave empty to show the shop's own, from Storefront settings."
          >
            <Textarea
              id="package-cancellation_policy"
              rows={3}
              value={pkg.cancellation_policy}
              onChange={(e) => set({ cancellation_policy: e.target.value })}
            />
          </Field>
        </fieldset>
      </Section>
    </>
  )
}

function ListField({
  label,
  items,
  canWrite,
  error,
  onChange,
}: {
  label: string
  items: string[]
  canWrite: boolean
  error?: string
  onChange: (items: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-400">
        {label}
      </p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            aria-label={`${label} ${i + 1}`}
            value={item}
            onChange={(e) =>
              onChange(items.map((x, j) => (j === i ? e.target.value : x)))
            }
          />
          {canWrite && (
            <RemoveButton
              label={`Remove ${label.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            />
          )}
        </div>
      ))}
      {error && <p className="text-xs text-error-500">{error}</p>}
      {canWrite && (
        <Button
          size="sm"
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => onChange([...items, ""])}
        >
          Add
        </Button>
      )}
    </div>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-white/5"
    >
      {children}
    </button>
  )
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <IconButton label={label} onClick={onClick}>
      <X aria-hidden className="size-4" />
    </IconButton>
  )
}
