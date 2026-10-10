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
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={cx("mx-auto", wide ? "max-w-full" : "max-w-5xl")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h1>
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
