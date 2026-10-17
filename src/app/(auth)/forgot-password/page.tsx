"use client"

import Label from "@/components/form/Label"
import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { AuthError, useSession } from "@/lib/auth/session"
import { useActionState } from "react"

import { AuthAlert, AuthHeading, Required, SwitchLine } from "../parts"

type Sent = { email: string } | { error: string } | null

/**
 * P1-089: asks for a password reset link (BR-094). The API answers the same
 * for any email (BR-021), so this screen does too. A Google-only user adds a
 * password this way.
 */
export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useSession()
  const [state, submit, pending] = useActionState<Sent, FormData>(
    async (_previous, form) => {
      const email = String(form.get("email") ?? "")
      try {
        await requestPasswordReset(email)
        return { email }
      } catch (err) {
        return {
          error:
            err instanceof AuthError ? err.message : "Could not send the link.",
        }
      }
    },
    null,
  )

  if (state && "email" in state)
    return (
      <div>
        <AuthHeading title="Check your inbox">
          If an account uses {state.email}, a link to set a new password is on
          its way. It works once, for 30 minutes.
        </AuthHeading>
        <SwitchLine question="Remembered it?" href="/login" action="Sign In" />
      </div>
    )

  return (
    <div>
      <AuthHeading title="Forgot your password?">
        Enter your email and we will send a link to set a new one. Signed up
        with Google? This adds a password.
      </AuthHeading>

      <form action={submit} className="flex flex-col gap-5">
        {state && <AuthAlert>{state.error}</AuthAlert>}
        <div>
          <Label htmlFor="email">
            <Required>Email</Required>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            autoFocus
            error={Boolean(state)}
          />
        </div>
        <Button type="submit" className="w-full" isLoading={pending}>
          Send reset link
        </Button>
      </form>

      <SwitchLine question="Remembered it?" href="/login" action="Sign In" />
    </div>
  )
}
