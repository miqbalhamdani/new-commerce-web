"use client"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { AuthError, useSession } from "@/lib/auth/session"
import { Logo } from "@/../public/Logo"
import { useRouter } from "next/navigation"
import { useActionState } from "react"

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
    <main className="flex min-h-screen items-start justify-center px-6 pt-24 sm:items-center sm:pt-0 sm:pb-24">
      <div className="w-full max-w-sm">
        <Logo className="h-8 w-8 text-blue-500 dark:text-blue-500" aria-hidden={true} />
        <h1 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-50">
          Sign in to New Commerce
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
          Use the email address your workspace owner invited.
        </p>

        <form action={submit} className="mt-8 flex flex-col gap-4">
          {error && (
            // An error a user must act on has to be announced when it appears,
            // not only when they happen to tab past it.
            <div
              role="alert"
              className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/70 dark:text-red-400"
            >
              <span className="font-medium">Sign in failed. </span>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
            >
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              autoFocus
              hasError={Boolean(error)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              hasError={Boolean(error)}
            />
          </div>

          <Button
            type="submit"
            className="mt-2 w-full"
            isLoading={pending}
            loadingText="Signing in…"
          >
            Sign in
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500">
          Trouble signing in? Ask your workspace owner to resend your
          invitation.
        </p>
      </div>
    </main>
  )
}
