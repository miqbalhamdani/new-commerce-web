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
  "": "Products",
  categories: "Categories",
  brands: "Brands",
  media: "Media",
  export: "Export",
  settings: "Settings",
  team: "Team",
  "api-keys": "API keys",
  quotes: "Quotes",
  overview: "Overview",
  monitoring: "Monitoring",
  audits: "Audits",
}

function label(segment: string) {
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
    <nav aria-label="Breadcrumb" className="ml-2">
      <ol role="list" className="flex items-center space-x-3 text-sm">
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center space-x-3">
            {i > 0 && (
              <ChevronRight
                className="size-4 shrink-0 text-gray-600 dark:text-gray-400"
                aria-hidden="true"
              />
            )}
            {crumb.current ? (
              // The page you are on is not a link, and aria-current is how a
              // screen reader learns which crumb that is.
              <span
                aria-current="page"
                className="text-gray-900 dark:text-gray-50"
              >
                {crumb.name}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-300"
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
