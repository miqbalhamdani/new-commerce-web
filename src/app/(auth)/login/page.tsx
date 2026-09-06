"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AuthError, useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Callout } from "@/components/ui/Callout";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const { signIn } = useSession();
  const router = useRouter();

  // React 19 form action: the pending state comes from the framework rather
  // than a variable somebody has to remember to reset on the error path.
  const [error, submit, pending] = useActionState<string | null, FormData>(
    async (_previous, formData) => {
      try {
        await signIn(
          String(formData.get("email") ?? ""),
          String(formData.get("password") ?? ""),
        );
        router.replace("/");
        return null;
      } catch (err) {
        return err instanceof AuthError ? err.message : "Could not sign in.";
      }
    },
    null,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-start justify-center px-6 pb-24 sm:items-center sm:pb-32">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            {/* A mark rather than a logo file: one less asset to keep, and it
                reads at any size. */}
            <div
              className="mb-5 flex size-9 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-ink"
              aria-hidden="true"
            >
              NC
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink">
              Sign in to New Commerce
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Use the email address your workspace owner invited.
            </p>
          </div>

          <form action={submit} className="flex flex-col gap-5">
            {error && (
              <Callout variant="error" title="Sign in failed">
                {error}
              </Callout>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
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
              className="mt-1 w-full"
              isLoading={pending}
              loadingText="Signing in…"
            >
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-ink-muted">
            Trouble signing in? Ask your workspace owner to resend your
            invitation.
          </p>
        </div>
      </main>
    </div>
  );
}
