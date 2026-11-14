import Badge from "@/components/ui/badge/Badge"
import type { PlatformShop } from "@/lib/api/types"
import { planLabel, statusOf } from "@/lib/platform"

/** The one status a shop is in, as words: colour is never the only cue. */
export function StatusBadge({ shop }: { shop: PlatformShop }) {
  const { label, color } = statusOf(shop)
  return (
    <Badge size="sm" color={color}>
      {label}
    </Badge>
  )
}

/** The plan, and Umrah when the shop is a travel agency (BR-160, BR-170). */
export function PlanBadges({ shop }: { shop: PlatformShop }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge size="sm" color={shop.plan === "mulai" ? "light" : "primary"}>
        {planLabel(shop.plan)}
      </Badge>
      {shop.business_type === "umrah" && (
        <Badge size="sm" color="info">
          Umrah
        </Badge>
      )}
    </span>
  )
}
