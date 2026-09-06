"use client"

import { SidebarProvider, SidebarTrigger } from "@/components/Sidebar"
import { AppSidebar } from "@/components/ui/navigation/AppSidebar"
import { Breadcrumbs } from "@/components/ui/navigation/Breadcrumbs"
import { useSession } from "@/lib/auth/session"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * The authenticated half of the app. Everything under (app) is behind this.
 *
 * The guard is a convenience, not the security boundary -- the API refuses
 * every request without a valid token regardless of what this renders. Its job
 * is to avoid showing a shell full of empty panels to someone who is not signed
 * in.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "anonymous") router.replace("/login")
  }, [status, router])

  // "loading" is the first paint, before the refresh call has answered.
  // Rendering the signed-out state here would flash the login screen at
  // everyone who is, in fact, signed in.
  if (status !== "authenticated") {
    return (
      <div className="flex h-full items-center justify-center">
        <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
          Loading…
        </p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="w-full">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
          <SidebarTrigger className="-ml-1" />
          <div className="mr-2 h-4 w-px bg-gray-200 dark:bg-gray-800" />
          <Breadcrumbs />
        </header>
        <main>{children}</main>
      </div>
    </SidebarProvider>
  )
}
