import type { BusinessType, PlatformShop, ShopPlan } from "@/lib/api/types"

/** BR-150: a verified shop with no activity in 14 days. */
const SLEEPS_AFTER_MS = 14 * 24 * 60 * 60 * 1000

export function isSleeping(shop: PlatformShop, now = Date.now()) {
  if (shop.owner?.status !== "active") return false
  if (!shop.last_activity_at) return true
  return now - new Date(shop.last_activity_at).getTime() > SLEEPS_AFTER_MS
}

/** BR-160's plans, smallest first. */
export const planOptions: readonly { value: ShopPlan; label: string }[] = [
  { value: "mulai", label: "Mulai" },
  { value: "katalog", label: "Katalog" },
  { value: "jualan", label: "Jualan" },
]

export const planLabel = (plan: ShopPlan) =>
  planOptions.find((p) => p.value === plan)?.label ?? plan

/** A paid period that ends within 7 days, or has ended (BR-160: shown only). */
const ENDS_SOON_MS = 7 * 24 * 60 * 60 * 1000

export function endsSoon(shop: PlatformShop, now = Date.now()) {
  if (!shop.plan_until) return false
  const end = new Date(`${shop.plan_until}T23:59:59+07:00`).getTime()
  return end - now <= ENDS_SOON_MS
}

/** BR-170's business types. */
export const businessTypeOptions: readonly { value: BusinessType; label: string }[] = [
  { value: "retail", label: "Retail shop" },
  { value: "umrah", label: "Umrah travel" },
]

/**
 * One reason a shop is in the state it is, worst first: off (suspended or
 * closed), never verified, a paid period ending, asleep, or fine.
 */
export function statusOf(shop: PlatformShop, now = Date.now()) {
  if (shop.status !== "active")
    return {
      label: shop.status === "suspended" ? "Suspended" : "Closed",
      color: "error",
    } as const
  if (shop.owner?.status === "invited")
    return { label: "Not verified", color: "warning" } as const
  if (endsSoon(shop, now)) return { label: "Plan ending", color: "warning" } as const
  if (isSleeping(shop, now)) return { label: "Sleeping", color: "light" } as const
  return { label: "Active", color: "success" } as const
}

/** A shop the founder should look at: not verified, asleep, or its paid period ending. */
export function needsAttention(shop: PlatformShop, now = Date.now()) {
  return (
    shop.status === "active" &&
    (shop.owner?.status === "invited" || isSleeping(shop, now) || endsSoon(shop, now))
  )
}

/** On a plan above Mulai (BR-160). */
export const isPaying = (shop: PlatformShop) =>
  shop.plan === "katalog" || shop.plan === "jualan"

/** CLI and demo-seed shops, kept out of the counts and the main list. */
export const isDemo = (shop: PlatformShop) => shop.source === "cli"
