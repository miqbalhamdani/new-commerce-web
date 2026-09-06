"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiCloseLine, RiLogoutBoxRLine, RiMenuLine } from "@remixicon/react";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cx, focusRing } from "@/lib/utils/cx";

/**
 * Navigation, keyed by the permission each destination needs.
 *
 * A user who lacks the permission does not see the link at all. Rendering it
 * disabled would advertise a capability they do not have and generate a support
 * question -- CLAUDE.md is explicit that absent beats disabled.
 *
 * Grouped because seven flat links read as a list to search rather than a shape
 * to recognise, and the grouping is real: catalog work is daily, settings is
 * occasional and owner-shaped.
 */
const sections = [
  {
    label: "Catalog",
    items: [
      { name: "Products", href: "/", permission: "products:read" },
      { name: "Categories", href: "/categories", permission: "categories:read" },
      { name: "Brands", href: "/brands", permission: "brands:read" },
      { name: "Media", href: "/media", permission: "media:read" },
      { name: "Export", href: "/export", permission: "exports:read" },
    ],
  },
  {
    label: "Settings",
    items: [
      { name: "Team", href: "/settings/team", permission: "users:read" },
      { name: "API keys", href: "/settings/api-keys", permission: "api_keys:read" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, tenant, signOut } = useSession();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const visible = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        user?.permissions.includes(item.permission),
      ),
    }))
    // A heading above nothing is worse than no heading.
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Only reachable by keyboard, and only worth showing once focused. The
          alternative is tabbing through every nav link on every page. */}
      <a
        href="#content"
        className={cx(
          "sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg",
          ...focusRing,
        )}
      >
        Skip to content
      </a>

      {/* Backdrop, mobile only. */}
      {navOpen && (
        <button
          className="fixed inset-0 z-30 bg-ink/20 backdrop-blur-[1px] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <nav
        aria-label="Main"
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface transition-transform duration-200 lg:static lg:w-auto lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-4">
          <div className="min-w-0">
            {/* Truncates rather than wraps: a long tenant name must not push
                the navigation down the page. */}
            <p className="truncate text-sm font-semibold text-ink">
              {tenant?.name}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {user?.name} · {user?.role}
            </p>
          </div>
          <Button
            variant="ghost"
            className="size-8 shrink-0 justify-center p-0 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <RiCloseLine className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-3">
          {visible.map((section) => (
            <div key={section.label} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-[0.6875rem] font-medium tracking-wider text-ink-muted uppercase">
                {section.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const current = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setNavOpen(false)}
                        // aria-current is how a screen reader learns which page
                        // it is on; a background colour does not say so.
                        aria-current={current ? "page" : undefined}
                        className={cx(
                          "block rounded-md px-3 py-1.5 text-sm transition-colors",
                          current
                            ? "bg-accent-soft font-medium text-accent"
                            : "text-ink-soft hover:bg-raised hover:text-ink",
                          ...focusRing,
                        )}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-line p-3">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => void signOut()}
          >
            <RiLogoutBoxRLine className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 lg:px-8">
          <Button
            variant="ghost"
            className="size-9 justify-center p-0 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <RiMenuLine className="size-4" aria-hidden="true" />
          </Button>
          <span className="hidden text-sm text-ink-muted lg:block">
            {tenant?.timezone} · {tenant?.currency}
          </span>
          <ThemeToggle />
        </header>

        <main id="content" className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
