"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"

import Label from "@/components/form/Label"
import Button from "@/components/ui/button/Button"
import { AuthError, useSession } from "@/lib/auth/session"

import { PasswordInput } from "../PasswordInput"
import { AuthAlert, AuthHeading, SwitchLine } from "../parts"

/**
 * P1-089: the reset link lands here with its token in the URL fragment, which
 * never reaches a server or its logs. The person sets a new password and is
 * signed in; every other session ends (BR-094).
 */
export default function ResetPasswordPage() {
  const { resetPassword } = useSession()
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    setToken(
      new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
    )
  }, [])

  const [error, submit, pending] = useActionState<string | null, FormData>(
    async (_prev, form) => {
      const password = String(form.get("password") ?? "")
      if (password !== String(form.get("confirm") ?? ""))
        return "The two passwords are not the same."
      try {
        await resetPassword(token ?? "", password)
        router.replace("/")
        return null
      } catch (err) {
        return err instanceof AuthError
          ? err.message
          : "Could not set the password."
      }
    },
    null,
  )

  return (
    <div>
      <AuthHeading title="Set a new password">
        Choose a password. You will be signed out everywhere else.
      </AuthHeading>

      {token === "" ? (
        <AuthAlert>
          This link is incomplete. Open the email again, or ask for a new link.
        </AuthAlert>
      ) : (
        <form action={submit} className="flex flex-col gap-5">
          {error && <AuthAlert>{error}</AuthAlert>}
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

      <SwitchLine
        question="Need a new link?"
        href="/forgot-password"
        action="Send another"
      />
    </div>
  )
}
