"use client"

import { SidebarProvider, useSidebar } from "@/context/SidebarContext"
import AppHeader from "@/layout/AppHeader"
import AppSidebar from "@/layout/AppSidebar"
import Backdrop from "@/layout/Backdrop"
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
      <Shell>{children}</Shell>
    </SidebarProvider>
  )
}

/** TailAdmin's admin layout: the content column shifts with the sidebar. */
function Shell({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <main className="mx-auto max-w-screen-2xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
