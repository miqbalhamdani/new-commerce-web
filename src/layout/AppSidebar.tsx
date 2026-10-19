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
  Contact,
  KeyRound,
  ShoppingCart,
  Boxes,
  FolderTree,
  LayoutDashboard,
  Newspaper,
  Package,
  ScrollText,
  Settings,
  Store,
  Tags,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { Logo } from "../../public/Logo"

/**
 * Navigation in titled groups, each item keyed by the permission its
 * destination needs.
 *
 * A user who lacks the permission does not see the link at all. Rendering it
 * disabled would advertise a capability they do not have and generate a
 * support question -- absent beats disabled (BR-025). A group with nothing
 * visible hides its title too, so ops never sees an empty "Admin".
 */
const groups = [
  {
    title: "Overview",
    items: [
      // P1-114: the home. "/" is a prefix of every path, so activeHref
      // matches it only exactly.
      { name: "Dashboard", href: "/", icon: LayoutDashboard, permission: "orders:read" },
    ],
  },
  {
    title: "Sales",
    items: [
      // Orders first: the PRD calls the order list ops' daily workspace (§6.1).
      { name: "Orders", href: "/orders", icon: ShoppingCart, permission: "orders:read" },
      {
        name: "Customers",
        href: "/customers",
        icon: Contact,
        permission: "customers:read",
      },
    ],
  },
  {
    title: "Catalog",
    items: [
      { name: "Products", href: "/products", icon: Package, permission: "products:read" },
      {
        name: "Categories",
        href: "/categories",
        icon: FolderTree,
        permission: "categories:read",
      },
      { name: "Brands", href: "/brands", icon: Boxes, permission: "brands:read" },
    ],
  },
  {
    // P1-606, P1-607: the journal the shop's website reads (M6).
    title: "Blog",
    items: [
      { name: "Posts", href: "/blog", icon: Newspaper, permission: "blog:read" },
      {
        name: "Blog categories",
        href: "/blog/categories",
        icon: Tags,
        permission: "blog:read",
      },
    ],
  },
  {
    title: "Storefront",
    items: [
      {
        name: "Storefront",
        href: "/settings/storefront",
        icon: Store,
        permission: "settings:read",
      },
      {
        name: "API keys",
        href: "/settings/api-keys",
        icon: KeyRound,
        permission: "api_keys:read",
      },
    ],
  },
  {
    title: "Admin",
    items: [
      { name: "Team", href: "/settings/team", icon: Users, permission: "users:read" },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "settings:read",
      },
      {
        name: "Audit log",
        href: "/audit-log",
        icon: ScrollText,
        permission: "audit_log:read",
      },
    ],
  },
]

const navigation = groups.flatMap((group) => group.items)

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

  const visibleGroups = groups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) =>
        user?.permissions.includes(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0)
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
        <nav className="flex flex-col gap-6">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <h2
                className={`mb-4 flex text-xs uppercase leading-5 text-gray-400 ${
                  showLabels ? "justify-start" : "lg:justify-center"
                }`}
              >
                {showLabels ? group.title : <HorizontaLDots />}
              </h2>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
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
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
