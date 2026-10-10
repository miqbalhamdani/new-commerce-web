"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"

import Label from "@/components/form/Label"
import Button from "@/components/ui/button/Button"
import { AuthError, useSession } from "@/lib/auth/session"

import { PasswordInput } from "../PasswordInput"

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
    <div>
      <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        Join your team
      </h1>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        Choose a password to finish setting up your account.
      </p>

      {token === "" ||
      (token === null &&
        typeof window !== "undefined" &&
        !window.location.hash) ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-error-500 bg-error-50 p-3 text-theme-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
        >
          This link is incomplete. Open the invitation email again, or ask for a
          new invitation.
        </p>
      ) : (
        <form action={submit} className="mt-6 flex flex-col gap-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-error-500 bg-error-50 p-3 text-theme-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
            >
              {error}
            </div>
          )}
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="confirm">The same password again</Label>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="mt-1 w-full" isLoading={pending}>
            Set password and sign in
          </Button>
        </form>
      )}
    </div>
  )
}
