import type { PlatformShop, ShopPlan } from "@/lib/api/types"

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
