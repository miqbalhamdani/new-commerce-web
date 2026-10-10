"use client"

// Derived from TailAdmin's AppSidebar (@3f6902572e9d) and ours to edit. The
// demo nav, submenu machinery and the upsell widget are gone; what remains is
// the aside with TailAdmin's expand/collapse/hover-expand/mobile behaviors,
// driven by SidebarContext, rendering our permission-gated navigation.
//
// Nav icons are lucide (one consistent family in the list) because the free
// TailAdmin icon set has no gear, tree or catalog marks.

import { useSidebar } from "@/context/SidebarContext"
import { HorizontaLDots } from "@/icons"
import { useSession } from "@/lib/auth/session"
import {
  ShoppingCart,
  Boxes,
  FolderTree,
  Package,
  ScrollText,
  Settings,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { Logo } from "../../public/Logo"

/**
 * Navigation, keyed by the permission each destination needs.
 *
 * A user who lacks the permission does not see the link at all. Rendering it
 * disabled would advertise a capability they do not have and generate a
 * support question -- absent beats disabled (BR-025).
 */
const navigation = [
  // Orders first: the PRD calls the order list ops' daily workspace (§6.1).
  { name: "Orders", href: "/orders", icon: ShoppingCart, permission: "orders:read" },
  { name: "Products", href: "/products", icon: Package, permission: "products:read" },
  {
    name: "Categories",
    href: "/categories",
    icon: FolderTree,
    permission: "categories:read",
  },
  { name: "Brands", href: "/brands", icon: Boxes, permission: "brands:read" },
  { name: "Team", href: "/settings/team", icon: Users, permission: "users:read" },
  { name: "Settings", href: "/settings", icon: Settings, permission: "settings:read" },
  {
    name: "Audit log",
    href: "/audit-log",
    icon: ScrollText,
    permission: "audit_log:read",
  },
] as const

/** The item a path belongs to: the longest href it starts with. */
function activeHref(pathname: string) {
  return navigation
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0]
}

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar()
  const { user, tenant } = useSession()
  const pathname = usePathname()

  const permitted = navigation.filter((item) =>
    user?.permissions.includes(item.permission),
  )
  const showLabels = isExpanded || isHovered || isMobileOpen

  return (
    <aside
      className={`fixed left-0 top-0 z-99999 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 lg:mt-0
        ${showLabels ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center gap-3 py-8 ${showLabels ? "" : "lg:justify-center"}`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center">
          <Logo className="size-8 text-brand-500" />
        </span>
        {showLabels && (
          /* min-w-0 plus truncate: a long tenant name must not push the
             navigation sideways. */
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-gray-800 dark:text-white/90">
              {tenant?.name}
            </span>
            <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
              {user?.name} · {user?.role}
            </span>
          </div>
        )}
      </div>

      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav>
          <h2
            className={`mb-4 flex text-xs uppercase leading-5 text-gray-400 ${
              showLabels ? "justify-start" : "lg:justify-center"
            }`}
          >
            {showLabels ? "Menu" : <HorizontaLDots />}
          </h2>
          <ul className="flex flex-col gap-1">
            {permitted.map((item) => {
              const active = activeHref(pathname) === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`menu-item group ${
                      active ? "menu-item-active" : "menu-item-inactive"
                    } ${showLabels ? "" : "lg:justify-center"}`}
                  >
                    <item.icon
                      aria-hidden="true"
                      className={`size-5 shrink-0 ${
                        active ? "menu-item-icon-active" : "menu-item-icon-inactive"
                      }`}
                    />
                    {showLabels && <span>{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </aside>
  )
}
