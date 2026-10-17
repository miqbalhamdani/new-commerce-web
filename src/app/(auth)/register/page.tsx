"use client"

import { useRouter } from "next/navigation"
import { useActionState, useState } from "react"

import Label from "@/components/form/Label"
import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { AuthError, useSession } from "@/lib/auth/session"

import { GoogleButton } from "../GoogleButton"
import { AuthAlert, AuthHeading, Required, SwitchLine } from "../parts"

/**
 * P1-085, P1-087: anyone opens a shop here. By email: shop name, name and
 * email, then the 6-digit code screen, then a password (BR-026). By Google:
 * Google already confirmed the email, so only the shop name is asked
 * (BR-020).
 */
export default function RegisterPage() {
  const { register, googleRegister } = useSession()
  const router = useRouter()
  const [googleToken, setGoogleToken] = useState<string | null>(null)

  const [error, submit, pending] = useActionState<string | null, FormData>(
    async (_previous, form) => {
      const email = String(form.get("email") ?? "").trim()
      try {
        await register(
          String(form.get("shop_name") ?? "").trim(),
          String(form.get("name") ?? "").trim(),
          email,
        )
        // In the fragment, like the invitation token: it never reaches a
        // server log.
        router.push(`/verify#email=${encodeURIComponent(email)}`)
        return null
      } catch (err) {
        return err instanceof AuthError
          ? err.message
          : "Could not create the shop."
      }
    },
    null,
  )

  if (googleToken)
    return (
      <GoogleShopName
        onBack={() => setGoogleToken(null)}
        onSubmit={async (shopName) => {
          await googleRegister(googleToken, shopName)
          router.replace("/onboarding")
        }}
      />
    )

  return (
    <div>
      <AuthHeading title="Sign Up">Open your shop in a minute.</AuthHeading>

      <GoogleButton text="signup_with" onCredential={setGoogleToken} />

      <form action={submit} className="flex flex-col gap-5">
        {error && <AuthAlert>{error}</AuthAlert>}

        <div>
          <Label htmlFor="shop_name">
            <Required>Shop name</Required>
          </Label>
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
          <Label htmlFor="name">
            <Required>Your name</Required>
          </Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Budi Santoso"
            required
            maxLength={100}
          />
        </div>

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
            maxLength={254}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            We will send a 6-digit code to confirm it.
          </p>
        </div>

        <Button type="submit" className="w-full" isLoading={pending}>
          Sign Up
        </Button>
      </form>

      <SwitchLine
        question="Already have an account?"
        href="/login"
        action="Sign In"
      />
    </div>
  )
}

/** After Google: the one thing Google cannot tell us. */
function GoogleShopName({
  onBack,
  onSubmit,
}: {
  onBack: () => void
  onSubmit: (shopName: string) => Promise<void>
}) {
  const [error, submit, pending] = useActionState<string | null, FormData>(
    async (_previous, form) => {
      try {
        await onSubmit(String(form.get("shop_name") ?? "").trim())
        return null
      } catch (err) {
        return err instanceof AuthError
          ? err.message
          : "Could not create the shop."
      }
    },
    null,
  )
  return (
    <div>
      <AuthHeading title="One more step">
        Google confirmed your email. What is your shop called?
      </AuthHeading>
      <form action={submit} className="flex flex-col gap-5">
        {error && <AuthAlert>{error}</AuthAlert>}
        <div>
          <Label htmlFor="google_shop_name">
            <Required>Shop name</Required>
          </Label>
          <Input
            id="google_shop_name"
            name="shop_name"
            autoComplete="organization"
            placeholder="Erigo"
            required
            maxLength={100}
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" isLoading={pending}>
          Create shop
        </Button>
      </form>
      <p className="mt-5 text-center text-sm sm:text-start">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
        >
          Use email instead
        </button>
      </p>
      <SwitchLine
        question="Already have an account?"
        href="/login"
        action="Sign In"
      />
    </div>
  )
}
