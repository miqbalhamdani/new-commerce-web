import { Logo } from "@/../public/Logo"

/**
 * The unauthenticated half: a centred card, no shell. Both auth screens share
 * this frame so neither builds its own centred main.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-16 sm:items-center sm:pb-16 sm:pt-0">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="size-10 text-brand-500" aria-hidden={true} />
          <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
            New Commerce
          </span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
          {children}
        </div>
      </div>
    </main>
  )
}
