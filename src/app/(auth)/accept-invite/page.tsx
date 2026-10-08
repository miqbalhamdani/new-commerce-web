"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"

import { Logo } from "@/../public/Logo"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { AuthError, useSession } from "@/lib/auth/session"

/**
 * P1-079: the invitation link lands here with its token in the URL fragment,
 * which never reaches a server or its logs. The person sets a password and is
 * signed in; their name was set when they were invited (BR-026).
 */
export default function AcceptInvitePage() {
  const { acceptInvite } = useSession()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token"))
  }, [])

  const [error, submit, pending] = useActionState<string | null, FormData>(
    async (_prev, form) => {
      const password = String(form.get("password") ?? "")
      if (password !== String(form.get("confirm") ?? ""))
        return "The two passwords are not the same."
      try {
        await acceptInvite(token ?? "", password)
        router.replace("/")
        return null
      } catch (err) {
        return err instanceof AuthError
          ? err.message
          : "Could not accept the invitation."
      }
    },
    null,
  )

  return (
    <main className="flex min-h-screen items-start justify-center px-6 pt-24 sm:items-center sm:pb-24 sm:pt-0">
      <div className="w-full max-w-sm">
        <Logo className="h-8 w-8 text-blue-500" aria-hidden={true} />
        <h1 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-50">
          Join your team
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Choose a password to finish setting up your account.
        </p>

        {token === "" ||
        (token === null &&
          typeof window !== "undefined" &&
          !window.location.hash) ? (
          <p
            role="alert"
            className="mt-8 rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/70 dark:text-red-400"
          >
            This link is incomplete. Open the invitation email again, or ask for
            a new invitation.
          </p>
        ) : (
          <form action={submit} className="mt-8 flex flex-col gap-4">
            {error && (
              <div
                role="alert"
                className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/70 dark:text-red-400"
              >
                {error}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="confirm" className="text-sm font-medium">
                The same password again
              </label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
            <Button
              type="submit"
              className="mt-2 w-full"
              isLoading={pending}
              loadingText="Setting up…"
            >
              Set password and sign in
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
