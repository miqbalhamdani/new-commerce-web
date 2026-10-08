import { cx } from "@/lib/utils"
import Link from "next/link"

/**
 * A next/link dressed as the vendored Button. The vendored Button renders a
 * real <button> with no asChild, and a navigation dressed as a button should
 * still be a link -- middle-click and new-tab must work.
 */
export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string
  variant?: "primary" | "outline"
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900",
        variant === "primary"
          ? "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600"
          : "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300",
        className,
      )}
    >
      {children}
    </Link>
  )
}
