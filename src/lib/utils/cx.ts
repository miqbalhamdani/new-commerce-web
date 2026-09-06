import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, letting a later class win over an earlier one
 * that sets the same property.
 *
 * Without twMerge, `cx("px-3", "px-6")` emits both and the winner depends on
 * stylesheet order rather than argument order -- so a component's variant could
 * not reliably be overridden by a caller.
 *
 * Tremor's own convention, and the reason every component below takes a
 * className prop and ends with cx(..., className).
 */
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

/** Ring styles Tremor uses for keyboard focus. Applied to every control. */
export const focusRing = [
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  "outline-blue-500 dark:outline-blue-500",
];

/** Border and ring treatment for an input in an error state. */
export const hasErrorInput = [
  "ring-2",
  "border-red-500 dark:border-red-700",
  "ring-red-200 dark:ring-red-700/30",
];
