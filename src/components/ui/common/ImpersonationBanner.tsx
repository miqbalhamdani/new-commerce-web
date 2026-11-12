"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { useSession } from "@/lib/auth/session"

/**
 * P1-917: on every screen while a platform admin works in someone else's
 * shop (BR-152), naming the shop, with the way back.
 */
export function ImpersonationBanner() {
  const { user, tenant, stopImpersonating } = useSession()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  if (!user?.impersonating) return null

  async function back() {
    setBusy(true)
    try {
      await stopImpersonating()
      router.push("/platform")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-error-500 px-4 py-2 text-center text-theme-sm text-white"
    >
      <span>
        You&apos;re in <strong>{tenant?.name}</strong> as its owner. Changes are
        logged as Belli.
      </span>
      <button
        type="button"
        onClick={back}
        disabled={busy}
        className="rounded-lg bg-white/15 px-3 py-1 font-medium hover:bg-white/25 disabled:opacity-60"
      >
        Back to Platform
      </button>
    </div>
  )
}
