"use client"

import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

/**
 * The trail to the current page, built from the URL.
 *
 * The template shipped this hardcoded to "Home / Quotes" with both links
 * pointing at "#", which is worse than no breadcrumb: it says the wrong thing
 * and goes nowhere.
 */
const labels: Record<string, string> = {
  "": "Home",
  orders: "Orders",
  customers: "Customers",
  products: "Products",
  categories: "Categories",
  brands: "Brands",
  import: "Import",
  settings: "Settings",
  team: "Team",
  "audit-log": "Audit log",
  onboarding: "Get started",
}

function label(segment: string) {
  // A record's id says nothing to a person; the page title names the record.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(segment)) return "Details"
  return (
    labels[segment] ??
    // Anything not listed still reads as words rather than a slug.
    segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  )
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  const crumbs = [
    { href: "/", name: label(""), current: segments.length === 0 },
    ...segments.map((segment, i) => ({
      href: "/" + segments.slice(0, i + 1).join("/"),
      name: label(segment),
      current: i === segments.length - 1,
    })),
  ]

  return (
    <nav aria-label="Breadcrumb">
      <ol role="list" className="flex items-center gap-1.5 text-theme-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight
                className="size-4 shrink-0 text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              />
            )}
            {crumb.current ? (
              // The page you are on is not a link, and aria-current is how a
              // screen reader learns which crumb that is.
              <span
                aria-current="page"
                className="text-gray-800 dark:text-white/90"
              >
                {crumb.name}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-500 transition hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
              >
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
