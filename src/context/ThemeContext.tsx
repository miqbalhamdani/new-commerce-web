"use client";

// PATCH(new-commerce): full-file replacement. Upstream's ThemeContext applied
// the saved theme from a useEffect, so a dark-mode user got a flash of light
// on every load, and it had no "system" setting. This app already runs
// next-themes (attribute="class", no-flash script, system support) from the
// root layout, so this file only re-exports upstream's hook shape on top of
// it. Both use the "theme" localStorage key. See src/components/PATCHES.md.

import { useTheme as useNextTheme } from "next-themes";

type Theme = "light" | "dark";

export const useTheme = (): { theme: Theme; toggleTheme: () => void } => {
  const { resolvedTheme, setTheme } = useNextTheme();
  // Before hydration resolvedTheme is undefined; light is the safe default
  // for the one render it exists.
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light";
  return {
    theme,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
};
