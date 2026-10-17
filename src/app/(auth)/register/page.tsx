"use client"

import Link from "next/link"
import { useActionState } from "react"

import Label from "@/components/form/Label"
import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { AuthError, useSession } from "@/lib/auth/session"

type State = { error: string | null; sentTo: string | null }

/**
 * P1-085: anyone opens a shop here (P1-084). The API answers the same
 * whether or not the email already has an account (BR-021), so this screen
 * always says "check your inbox"; the emailed link sets the password and
 * opens onboarding.
 */
export default function RegisterPage() {
  const { register } = useSession()

  const [state, submit, pending] = useActionState<State, FormData>(
    async (_previous, form) => {
      const email = String(form.get("email") ?? "").trim()
      try {
        await register(
          String(form.get("shop_name") ?? "").trim(),
          String(form.get("name") ?? "").trim(),
          email,
        )
        return { error: null, sentTo: email }
      } catch (err) {
        return {
          error:
            err instanceof AuthError
              ? err.message
              : "Could not create the shop.",
          sentTo: null,
        }
      }
    },
    { error: null, sentTo: null },
  )

  if (state.sentTo)
    return (
      <div role="status">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Check your inbox
        </h1>
        <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
          If <strong className="font-medium">{state.sentTo}</strong> can be
          used, we have sent it a link. Open it to confirm your email and choose
          a password. The link works for 7 days.
        </p>
        <p className="mt-4 text-theme-xs text-gray-500 dark:text-gray-400">
          No email after a few minutes? Check spam, or register again with the
          same address to get a new link.
        </p>
        <p className="mt-6 text-center text-theme-sm">
          <Link
            href="/login"
            className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    )

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
        Create your shop
      </h1>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        We will email you a link to confirm your address and choose a password.
      </p>

      <form action={submit} className="mt-6 flex flex-col gap-5">
        {state.error && (
          <div
            role="alert"
            className="rounded-xl border border-error-500 bg-error-50 p-3 text-theme-sm text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
          >
            {state.error}
          </div>
        )}

        <div>
          <Label htmlFor="shop_name">Shop name</Label>
          <Input
            id="shop_name"
            name="shop_name"
            autoComplete="organization"
            placeholder="Erigo"
            required
            maxLength={100}
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            maxLength={254}
          />
        </div>

        <Button type="submit" className="mt-1 w-full" isLoading={pending}>
          Create shop
        </Button>
      </form>

      <p className="mt-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
