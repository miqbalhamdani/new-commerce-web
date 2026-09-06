"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiLogoutBoxRLine } from "@remixicon/react";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { cx, focusRing } from "@/lib/utils/cx";

/**
 * Navigation, keyed by the permission each destination needs.
 *
 * A user who lacks the permission does not see the link at all. Rendering it
 * disabled would advertise a capability they do not have and generate a support
 * question -- CLAUDE.md is explicit that absent beats disabled.
 */
const navigation = [
  { name: "Catalog", href: "/", permission: "products:read" },
  { name: "Categories", href: "/categories", permission: "categories:read" },
  { name: "Brands", href: "/brands", permission: "brands:read" },
  { name: "Media", href: "/media", permission: "media:read" },
  { name: "Export", href: "/export", permission: "exports:read" },
  { name: "Team", href: "/settings/team", permission: "users:read" },
  { name: "API keys", href: "/settings/api-keys", permission: "api_keys:read" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, tenant, signOut } = useSession();
  const pathname = usePathname();

  const permitted = navigation.filter((item) =>
    user?.permissions.includes(item.permission),
  );

  return (
    <div className="flex min-h-screen">
      <nav
        aria-label="Main"
        className="flex w-56 shrink-0 flex-col gap-6 border-r border-gray-200 bg-white p-4 dark:border-gray-900 dark:bg-[#090E1A]"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {tenant?.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {user?.name} · {user?.role}
          </p>
        </div>

        <ul className="flex flex-col gap-1">
          {permitted.map((item) => {
            const current = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  // aria-current is how a screen reader learns which page it is
                  // on; the background colour alone does not say so.
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "block rounded-md px-3 py-2 text-sm transition",
                    current
                      ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-900 dark:text-gray-50"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-900/60",
                    ...focusRing,
                  )}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>

        <Button
          variant="ghost"
          className="mt-auto justify-start"
          onClick={() => void signOut()}
        >
          <RiLogoutBoxRLine className="size-4" aria-hidden="true" />
          Sign out
        </Button>
      </nav>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
