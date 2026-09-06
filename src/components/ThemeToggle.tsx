"use client";

import { useSyncExternalStore } from "react";
import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { Button } from "@/components/ui/Button";

type Theme = "light" | "dark";

/** The one key this app puts in localStorage. A remembered preference, not data. */
const STORAGE_KEY = "theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode, or storage disabled. The theme still applies for this
    // visit; only remembering it fails, which is not worth an error.
  }
}

/**
 * The class on <html> is the source of truth -- ThemeScript sets it before the
 * first paint, so React must read it rather than decide again.
 *
 * useSyncExternalStore is the primitive for reading state React does not own.
 * The obvious alternative, setState in a mount effect, means an extra render on
 * every page and is what the set-state-in-effect rule exists to catch. It also
 * gives a server snapshot, so SSR renders the light icon deterministically
 * instead of guessing.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "light" as Theme);

  return (
    <Button
      variant="ghost"
      className="size-9 justify-center p-0"
      onClick={() => {
        apply(theme === "dark" ? "light" : "dark");
        // Nothing else writes the class, so the store is notified here.
        listeners.forEach((notify) => notify());
      }}
      // The icon alone has no accessible name, and "toggle theme" does not say
      // what will happen.
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? (
        <RiSunLine className="size-4" aria-hidden="true" />
      ) : (
        <RiMoonLine className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}

/**
 * Applies the stored theme before the first paint.
 *
 * This has to be a blocking inline script. Doing it in an effect means the page
 * paints in the light theme and then flips -- the flash of the wrong theme that
 * every dark mode implementation starts out with.
 */
export function ThemeScript() {
  const script = `
    try {
      var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      var dark = stored ? stored === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (dark) document.documentElement.classList.add("dark");
    } catch (e) {}
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
