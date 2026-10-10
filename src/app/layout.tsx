import { SessionProvider } from "@/lib/auth/session"
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { Outfit } from "next/font/google"
import "./globals.css"

// TailAdmin's typeface. globals.css points font-outfit at this variable, and
// the body renders in it.
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

export const metadata: Metadata = {
  title: "New Commerce",
  description: "Catalog management for Indonesian merchants.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      {/* Browser extensions inject attributes onto <body> before React
          hydrates. Without this React sees server and client disagree and
          discards the tree. */}
      <body
        suppressHydrationWarning
        className={`${outfit.variable} h-full bg-gray-50 font-outfit antialiased dark:bg-gray-900`}
      >
        <ThemeProvider
          defaultTheme="system"
          disableTransitionOnChange
          attribute="class"
        >
          {/* Above the route groups: the login screen needs signIn and the app
              shell needs the session, and the refresh-on-mount must happen once
              for both. */}
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
