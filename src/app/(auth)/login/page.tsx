"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AuthError, useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";

export default function LoginPage() {
  const { signIn } = useSession();
  const router = useRouter();

  // React 19 form action: pending state comes from the framework rather than a
  // useState nobody remembers to reset on the error path.
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
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Sign in
        </h1>
        <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">
          Use the email your workspace owner invited.
        </p>

        <form action={submit} className="flex flex-col gap-4">
          {error && <Callout variant="error" title="Sign in failed">{error}</Callout>}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
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

          <Button type="submit" isLoading={pending} loadingText="Signing in…">
            Sign in
          </Button>
        </form>
      </Card>
    </main>
  );
}
