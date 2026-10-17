"use client"

import { useTheme } from "next-themes"
import Script from "next/script"
import { useEffect, useRef, useState } from "react"

import { useSession } from "@/lib/auth/session"

import { OrDivider } from "./parts"

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        client_id: string
        callback: (response: { credential: string }) => void
      }): void
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityServices
  }
}

/**
 * P1-087: Google's own sign-in button (only it hands back an ID token), with
 * the "Or" divider under it. Renders nothing while the API names no client ID
 * (BR-020), so an admin without Google shows the email form alone.
 */
export function GoogleButton({
  text,
  onCredential,
}: {
  text: "signin_with" | "signup_with"
  onCredential: (idToken: string) => void
}) {
  const { googleClientId } = useSession()
  const { resolvedTheme } = useTheme()
  const [clientId, setClientId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const latest = useRef(onCredential)
  latest.current = onCredential

  useEffect(() => {
    let live = true
    googleClientId().then((id) => live && setClientId(id))
    // The script may already be on the page from the other auth screen.
    if (window.google) setLoaded(true)
    return () => {
      live = false
    }
  }, [googleClientId])

  useEffect(() => {
    const google = window.google
    if (!clientId || !loaded || !google || !box.current) return
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => latest.current(response.credential),
    })
    google.accounts.id.renderButton(box.current, {
      type: "standard",
      size: "large",
      shape: "rectangular",
      logo_alignment: "center",
      text,
      locale: "en", // the admin is English (BR-016), whatever the browser's language
      theme: resolvedTheme === "dark" ? "filled_black" : "outline",
      width: Math.min(box.current.offsetWidth || 400, 400),
    })
  }, [clientId, loaded, resolvedTheme, text])

  if (!clientId) return null
  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client?hl=en"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
      />
      <div
        ref={box}
        data-testid="google-button"
        className="flex min-h-11 justify-center"
      />
      <OrDivider />
    </>
  )
}
