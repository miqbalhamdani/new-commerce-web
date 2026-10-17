"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import Label from "@/components/form/Label"
import Input from "@/components/form/input/InputField"
import Button from "@/components/ui/button/Button"
import { AuthError, useSession } from "@/lib/auth/session"

import { AuthAlert, AuthHeading, SwitchLine } from "../parts"

const LENGTH = 6
const RESEND_WAIT = 30

/**
 * P1-087: TailAdmin's two-step verification, for a signup's emailed code
 * (BR-026). The email arrives in the fragment from the sign-up screen; a
 * visitor who comes back later types it. The right code buys the invitation
 * token, and the password is set on accept-invite, which then opens
 * onboarding.
 */
export default function VerifyPage() {
  const { verifyCode, resendCode } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [typedEmail, setTypedEmail] = useState("")
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [wait, setWait] = useState(0)
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    setEmail(
      new URLSearchParams(window.location.hash.slice(1)).get("email") ?? "",
    )
  }, [])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const address = email || typedEmail.trim()
  const code = digits.join("")

  // Typing, an autofilled code or a paste: digits fill from this box onward.
  function fill(from: number, text: string) {
    const incoming = text
      .replace(/\D/g, "")
      .slice(0, LENGTH - from)
      .split("")
    if (incoming.length === 0) return
    setDigits((d) => {
      const next = [...d]
      incoming.forEach((c, k) => (next[from + k] = c))
      return next
    })
    boxes.current[Math.min(from + incoming.length, LENGTH - 1)]?.focus()
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (code.length < LENGTH) {
      setError("Enter all 6 digits of the code.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const token = await verifyCode(address, code)
      router.push(`/accept-invite#token=${encodeURIComponent(token)}&signup=1`)
    } catch (err) {
      setError(
        err instanceof AuthError ? err.message : "Could not check the code.",
      )
      setBusy(false)
    }
  }

  async function resend() {
    setError(null)
    try {
      await resendCode(address)
      setSent(true)
      setWait(RESEND_WAIT)
    } catch (err) {
      setError(
        err instanceof AuthError ? err.message : "Could not send the code.",
      )
    }
  }

  if (email === null) return null // the fragment is read after hydration

  return (
    <div>
      <AuthHeading title="Verify your email">
        {email ? (
          <>
            We sent a 6-digit code to{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {email}
            </span>
            . Enter it below.
          </>
        ) : (
          "Enter your email and the 6-digit code we sent to it."
        )}
      </AuthHeading>

      <form onSubmit={verify} className="flex flex-col gap-5">
        {error && <AuthAlert>{error}</AuthAlert>}
        {!email && (
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              required
            />
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
            Type your 6-digit code
          </legend>
          <div className="flex gap-2 sm:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el
                }}
                aria-label={`Digit ${i + 1} of ${LENGTH}`}
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                value={d}
                autoFocus={i === 0 && Boolean(email)}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "") {
                    setDigits((cur) => cur.map((c, k) => (k === i ? "" : c)))
                  } else {
                    fill(i, v.replace(d, "") || v)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !d && i > 0)
                    boxes.current[i - 1]?.focus()
                }}
                onPaste={(e) => {
                  e.preventDefault()
                  fill(i, e.clipboardData.getData("text"))
                }}
                className="h-12 w-full min-w-0 rounded-lg border border-gray-300 bg-transparent text-center text-xl font-semibold text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 sm:h-14 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800"
              />
            ))}
          </div>
        </fieldset>

        <Button type="submit" className="w-full" isLoading={busy}>
          Verify my account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-700 sm:text-start dark:text-gray-400">
        Didn&apos;t get the code?{" "}
        <button
          type="button"
          onClick={() => void resend()}
          disabled={!address || wait > 0}
          className="font-medium text-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-brand-400 dark:disabled:text-gray-500"
        >
          {wait > 0 ? `Resend in ${wait}s` : "Resend"}
        </button>
      </p>
      {sent && (
        <p
          role="status"
          className="mt-2 text-center text-theme-xs text-gray-500 sm:text-start dark:text-gray-400"
        >
          Sent again{email ? ` to ${email}` : ""}. Check spam if it does not
          arrive.
        </p>
      )}

      <SwitchLine
        question="Wrong email?"
        href="/register"
        action="Sign up again"
      />
    </div>
  )
}
