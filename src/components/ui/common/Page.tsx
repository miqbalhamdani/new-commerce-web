import { cx } from "@/lib/utils"

/** The frame every screen sits in: a title, a line saying what it is for, actions on the right. */
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className={cx("mx-auto", wide ? "max-w-7xl" : "max-w-5xl")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{title}</h1>
            {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cx("rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950", className)}>
      {children}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-500">{children}</div>}
    </Card>
  )
}

export function Loading() {
  return (
    <p role="status" className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
      Loading…
    </p>
  )
}
