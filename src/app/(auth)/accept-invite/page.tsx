"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"

import Label from "@/components/form/Label"
import Button from "@/components/ui/button/Button"
import { AuthError, useSession } from "@/lib/auth/session"

import { PasswordInput } from "../PasswordInput"
import { AuthHeading } from "../parts"

/**
 * P1-079: the invitation link lands here with its token in the URL fragment,
 * which never reaches a server or its logs. The person sets a password and is
 * signed in; their name was set when they were invited (BR-026).
 *
 * P1-085: a signup's confirmation link is the same invitation, marked
 * `signup=1`, and so is the token the 6-digit code buys (P1-087): it asks for
 * the owner's password and opens onboarding.
 */
export default function AcceptInvitePage() {
  const { acceptInvite } = useSession()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [signup, setSignup] = useState(false)

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    setToken(fragment.get("token"))
    setSignup(fragment.get("signup") === "1")
  }, [])

  const [error, submit, pending] = useActionState<string | null, FormData>(
    async (_prev, form) => {
      const password = String(form.get("password") ?? "")
      if (password !== String(form.get("confirm") ?? ""))
        return "The two passwords are not the same."
      try {
        await acceptInvite(token ?? "", password)
        router.replace(signup ? "/onboarding" : "/")
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
      <AuthHeading title={signup ? "Set your password" : "Join your team"}>
        {signup
          ? "Your email is confirmed. Choose a password to open your shop."
          : "Choose a password to finish setting up your account."}
      </AuthHeading>

      {token === "" ||
      (token === null &&
        typeof window !== "undefined" &&
        !window.location.hash) ? (
        <p
          role="alert"
          className="rounded-xl border border-error-500 bg-error-50 p-3 text-theme-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
        >
          This link is incomplete. Open the invitation email again, or ask for a
          new invitation.
        </p>
      ) : (
        <form action={submit} className="flex flex-col gap-5">
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
            {signup ? "Open my shop" : "Set password and sign in"}
          </Button>
        </form>
      )}
    </div>
  )
}
