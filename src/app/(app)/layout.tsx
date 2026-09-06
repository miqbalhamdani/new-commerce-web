"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session";
import { AppShell } from "@/components/AppShell";

/**
 * The authenticated half of the app. Everything under (app) is behind this.
 *
 * The guard is a convenience, not the security boundary -- the API refuses
 * every request without a valid token regardless of what this renders. Its job
 * is to avoid showing a shell full of empty panels to someone who is not signed
 * in.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  // "loading" is the first paint, before the refresh call has answered.
  // Rendering the signed-out state here would flash the login screen at
  // everyone who is, in fact, signed in.
  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
