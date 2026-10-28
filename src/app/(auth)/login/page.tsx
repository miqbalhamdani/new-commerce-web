"use client"

import Label from "@/components/form/Label"
import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { demoCredentials } from "@/lib/auth/demo"
import { AuthError, useSession } from "@/lib/auth/session"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react"

import { GoogleButton } from "../GoogleButton"
import { PasswordInput } from "../PasswordInput"
import { AuthAlert, AuthHeading, Required, SwitchLine } from "../parts"

/** P1-087: TailAdmin's sign-in, with Google when the API has a client ID. */
export default function LoginPage() {
  const { signIn, googleSignIn, status } = useSession()
  const router = useRouter()
  const [googleError, setGoogleError] = useState<string | null>(null)

  // React 19 form action: the pending state comes from the framework rather
  // than a variable somebody has to remember to reset on the error path.
  const [error, submit, pending] = useActionState<string | null, FormData>(
    async (_previous, formData) => {
      setGoogleError(null)
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

  // Demo links from belli.id (/login?u=…&p=…) sign straight into the demo
  // shop. Waits for the mount refresh: a refresh that settles after sign-in
  // would sign the new session out again.
  const demoTried = useRef(false)
  useEffect(() => {
    if (status === "loading" || demoTried.current) return
    demoTried.current = true
    const search = window.location.search
    // Never leave a password in the address bar or the history.
    if (new URLSearchParams(search).has("p"))
      window.history.replaceState(null, "", window.location.pathname)
    const demo = demoCredentials(search)
    if (!demo) return
    const form = new FormData()
    form.set("email", demo.email)
    form.set("password", demo.password)
    startTransition(() => submit(form))
  }, [status, submit])

  async function withGoogle(idToken: string) {
    setGoogleError(null)
    try {
      await googleSignIn(idToken)
      router.replace("/")
    } catch (err) {
      setGoogleError(
        err instanceof AuthError
          ? err.message
          : "Could not sign in with Google.",
      )
    }
  }

  return (
    <div>
      <AuthHeading title="Sign In">
        Enter your email and password to sign in!
      </AuthHeading>

      <GoogleButton
        text="signin_with"
        onCredential={(t) => void withGoogle(t)}
      />
      {googleError && (
        <div className="mb-5">
          <AuthAlert>{googleError}</AuthAlert>
        </div>
      )}

      <form action={submit} className="flex flex-col gap-5">
        {error && (
          <AuthAlert>
            <span className="font-medium">Sign in failed. </span>
            {error}
          </AuthAlert>
        )}

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
            error={Boolean(error)}
          />
        </div>

        <div>
          <Label htmlFor="password">
            <Required>Password</Required>
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            minLength={8}
            error={Boolean(error)}
          />
          {/* P1-089: also how a Google-only user adds a password (BR-094). */}
          <Link
            href="/forgot-password"
            className="mt-2 inline-block text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" isLoading={pending}>
          Sign in
        </Button>
      </form>

      <SwitchLine
        question="Don't have an account?"
        href="/register"
        action="Sign Up"
      />
    </div>
  )
}
