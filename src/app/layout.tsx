import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "New Commerce",
  description: "Catalog management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 antialiased dark:bg-gray-950">
        {/* Wraps everything: the login screen needs signIn, the app shell needs
            the session, and the refresh-on-mount has to happen once for both. */}
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
