import { Logo } from "@/../public/Logo"

/**
 * The unauthenticated half, laid out as TailAdmin's sign-in pages: the form on
 * the left, a brand panel on the right from lg up (on a phone the logo sits
 * above the form instead). TailAdmin's grid images are drawn here as SVG.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen bg-white dark:bg-gray-900">
      <main className="flex w-full flex-1 flex-col lg:w-1/2">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10 sm:px-0">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="size-9 text-brand-500" aria-hidden={true} />
            <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Belli.id
            </span>
          </div>
          {children}
        </div>
      </main>
      <aside className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-brand-950 lg:flex dark:bg-white/5">
        <GridShape
          id="grid-top"
          className="absolute right-0 top-0 w-full max-w-[250px] xl:max-w-[450px]"
        />
        <GridShape
          id="grid-bottom"
          className="absolute bottom-0 left-0 w-full max-w-[250px] rotate-180 xl:max-w-[450px]"
        />
        <div className="relative flex max-w-xs flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3">
            <Logo className="size-12 text-brand-500" aria-hidden={true} />
            <span className="text-3xl font-semibold text-white">Belli.id</span>
          </div>
          <p className="text-gray-400 dark:text-white/60">
            Catalog and order management for Indonesian merchants.
          </p>
        </div>
      </aside>
    </div>
  )
}

/** TailAdmin's grid-01 shape: a field of faint squares in a corner. */
function GridShape({ id, className }: { id: string; className: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 450 254" fill="none">
      <defs>
        <pattern id={id} width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" stroke="white" strokeOpacity="0.08" />
        </pattern>
      </defs>
      <rect width="450" height="254" fill={`url(#${id})`} />
    </svg>
  )
}
