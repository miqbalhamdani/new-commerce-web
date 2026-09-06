import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/auth/session";
import { ThemeScript } from "@/components/ThemeToggle";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before the first paint, or the page renders light and then flips. */}
        <ThemeScript />
      </head>
      {/* Browser extensions inject attributes onto <body> before React
          hydrates -- ColorZilla adds cz-shortcut-listen, Grammarly adds its
          own. Without this React sees server and client disagree and discards
          the tree. It suppresses the warning for this element's attributes
          only. */}
      <body suppressHydrationWarning className="bg-canvas text-ink antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
