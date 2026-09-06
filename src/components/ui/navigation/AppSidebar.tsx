"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarLink,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/Sidebar"
import { useSession } from "@/lib/auth/session"
import {
  Boxes,
  FolderTree,
  House,
  Images,
  KeyRound,
  Share,
  Users,
} from "lucide-react"
import { usePathname } from "next/navigation"
import * as React from "react"
import { Logo } from "../../../../public/Logo"
import { UserProfile } from "./UserProfile"

/**
 * Navigation, keyed by the permission each destination needs.
 *
 * A user who lacks the permission does not see the link at all. Rendering it
 * disabled would advertise a capability they do not have and generate a support
 * question -- CLAUDE.md is explicit that absent beats disabled.
 *
 * The permission strings are the contract's (API spec.md §3), and the client is
 * told which ones it holds at sign-in.
 */
const navigation = [
  { name: "Products", href: "/", icon: House, permission: "products:read" },
  {
    name: "Categories",
    href: "/categories",
    icon: FolderTree,
    permission: "categories:read",
  },
  { name: "Brands", href: "/brands", icon: Boxes, permission: "brands:read" },
  { name: "Media", href: "/media", icon: Images, permission: "media:read" },
  { name: "Export", href: "/export", icon: Share, permission: "exports:read" },
  {
    name: "Team",
    href: "/settings/team",
    icon: Users,
    permission: "users:read",
  },
  {
    name: "API keys",
    href: "/settings/api-keys",
    icon: KeyRound,
    permission: "api_keys:read",
  },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, tenant } = useSession()
  const pathname = usePathname()

  const permitted = navigation.filter((item) =>
    user?.permissions.includes(item.permission),
  )

  return (
    <Sidebar {...props} className="bg-gray-50 dark:bg-gray-925">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white p-1.5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
            <Logo className="size-6 text-blue-500 dark:text-blue-500" />
          </span>
          {/* min-w-0 plus truncate: a long tenant name must not push the
              navigation sideways. */}
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
              {tenant?.name}
            </span>
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
              {user?.name} · {user?.role}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {permitted.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarLink
                    href={item.href}
                    isActive={pathname === item.href}
                    icon={item.icon}
                  >
                    {item.name}
                  </SidebarLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="border-t border-gray-200 dark:border-gray-800" />
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  )
}
