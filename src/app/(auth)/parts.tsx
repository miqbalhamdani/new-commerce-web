import Link from "next/link"

/** The page title and its one line, sized as TailAdmin's auth pages are. */
export function AuthHeading({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
        {title}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>
    </div>
  )
}

/** "Or" between Google's button and the email form. */
export function OrDivider() {
  return (
    <div className="relative py-3 sm:py-5">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-gray-200 dark:border-gray-800" />
      </div>
      <p className="relative flex justify-center text-sm">
        <span className="bg-white p-2 text-gray-400 sm:px-5 sm:py-2 dark:bg-gray-900">
          Or
        </span>
      </p>
    </div>
  )
}

/** A field label with TailAdmin's red required mark, kept out of the accessible name. */
export function Required({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}{" "}
      <span aria-hidden className="text-error-500">
        *
      </span>
    </>
  )
}

/** The line under a form that leads to the other auth page. */
export function SwitchLine({
  question,
  href,
  action,
}: {
  question: string
  href: string
  action: string
}) {
  return (
    <p className="mt-5 text-center text-sm text-gray-700 sm:text-start dark:text-gray-400">
      {question}{" "}
      <Link
        href={href}
        className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
      >
        {action}
      </Link>
    </p>
  )
}

/** A refused request, announced when it appears. */
export function AuthAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-error-500 bg-error-50 p-3 text-theme-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
    >
      {children}
    </div>
  )
}
