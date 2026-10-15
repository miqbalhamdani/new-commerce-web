import { ChevronLeft } from "lucide-react"
import Link from "next/link"

import { Breadcrumbs } from "@/components/ui/navigation/Breadcrumbs"
import { cx } from "@/lib/utils"

/**
 * The frame every screen sits in, in TailAdmin's PageBreadCrumb shape: the
 * title on the left, the breadcrumb trail on the right, then a line saying
 * what the screen is for with its actions. The (app) layout owns the outer
 * padding and the 2xl ceiling; `wide` only picks how much of it to use.
 */
export function Page({
  title,
  description,
  actions,
  children,
  wide,
  back,
}: {
  /** A way back up, as an icon button left of the title. label names the
      destination for the accessible name: "Back to {label}". */
  back?: {
    href: string
    label: string
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
  }
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={cx("mx-auto", wide ? "max-w-full" : "max-w-5xl")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {back && (
            <Link
              href={back.href}
              onClick={back.onClick}
              aria-label={`Back to ${back.label}`}
              className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white text-theme-sm font-medium text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:pl-2 sm:pr-3.5 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <ChevronLeft aria-hidden className="size-5" />
              {/* The destination's name says what the button does; phones
                  keep the bare chevron so the title still fits. */}
              <span className="hidden capitalize sm:inline">{back.label}</span>
            </Link>
          )}
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {title}
          </h1>
        </div>
        <Breadcrumbs />
      </div>
      {(description || actions) && (
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="mt-6">{children}</div>
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]",
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * A titled card: a heading and one muted line saying what it holds, then the
 * body. id is the anchor publish failures scroll to.
 */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section id={id} aria-labelledby={headingId} tabIndex={-1}>
      <Card>
        <div className="p-6 pb-5">
          <h2
            id={headingId}
            className="text-base font-semibold text-gray-800 dark:text-white/90"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        <div className="px-6 pb-6">{children}</div>
      </Card>
    </section>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">{title}</p>
      {children && (
        <div className="mx-auto mt-1 max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
          {children}
        </div>
      )}
    </Card>
  )
}

export function Loading() {
  return (
    <p role="status" className="py-10 text-center text-theme-sm text-gray-500 dark:text-gray-400">
      Loading…
    </p>
  )
}
