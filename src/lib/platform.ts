import type { PlatformShop } from "@/lib/api/types"

/** BR-150: a verified shop with no activity in 14 days. */
const SLEEPS_AFTER_MS = 14 * 24 * 60 * 60 * 1000

export function isSleeping(shop: PlatformShop, now = Date.now()) {
  if (shop.owner?.status !== "active") return false
  if (!shop.last_activity_at) return true
  return now - new Date(shop.last_activity_at).getTime() > SLEEPS_AFTER_MS
}
