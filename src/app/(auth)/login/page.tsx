"use client"

import Label from "@/components/form/Label"
import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { AuthError, useSession } from "@/lib/auth/session"
import { useRouter } from "next/navigation"
import { useActionState } from "react"

import { PasswordInput } from "../PasswordInput"

export default function LoginPage() {
  const { signIn } = useSession()
  const router = useRouter()

  // React 19 form action: the pending state comes from the framework rather
  // than a variable somebody has to remember to reset on the error path.
  const [error, submit, pending] = useActionState<string | null, FormData>(
    async (_previous, formData) => {
      try {
        await signIn(
          String(formData.get("email") ?? ""),
          String(formData.get("password") ?? ""),
        )
        router.replace("/")
        return null
      } catch (err) {
        return err instanceof AuthError ? err.message : "Could not sign in."
      }
    },
    null,
  )

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        Sign in
      </h1>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        Use the email address your workspace owner invited.
      </p>

      <form action={submit} className="mt-6 flex flex-col gap-5">
        {error && (
          // An error a user must act on has to be announced when it appears,
          // not only when they happen to tab past it.
          <div
            role="alert"
            className="rounded-xl border border-error-500 bg-error-50 p-3 text-theme-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
          >
            <span className="font-medium">Sign in failed. </span>
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            autoFocus
            error={Boolean(error)}
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            error={Boolean(error)}
          />
        </div>

        <Button type="submit" className="mt-1 w-full" isLoading={pending}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-theme-xs text-gray-500 dark:text-gray-400">
        Trouble signing in? Ask your workspace owner to resend your invitation.
      </p>
    </div>
  )
}
