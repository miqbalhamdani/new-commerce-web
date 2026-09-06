// Tremor Input, following the conventions published at tremor.so.
"use client";

import React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cx, focusRing, hasErrorInput } from "@/lib/utils/cx";

const inputStyles = tv({
  base: [
    "relative block w-full appearance-none rounded-md border px-2.5 py-2 shadow-xs outline-hidden transition sm:text-sm",
    "border-gray-300 dark:border-gray-800",
    "text-gray-900 dark:text-gray-50",
    "placeholder-gray-400 dark:placeholder-gray-500",
    "bg-white dark:bg-gray-950",
    "disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400",
    "dark:disabled:border-gray-700 dark:disabled:bg-gray-800 dark:disabled:text-gray-500",
    ...focusRing,
  ],
  variants: { hasError: { true: hasErrorInput } },
});

interface InputProps
  extends React.ComponentPropsWithoutRef<"input">,
    VariantProps<typeof inputStyles> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cx(inputStyles({ hasError }), className)}
      // Announce the invalid state rather than only colouring the border --
      // a red outline is invisible to a screen reader and to anyone who cannot
      // distinguish it.
      aria-invalid={hasError ? true : undefined}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/** A form label. Always paired with an input via htmlFor. */
export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"label">) {
  return (
    <label
      className={cx(
        "text-sm leading-none font-medium text-gray-900 dark:text-gray-50",
        className,
      )}
      {...props}
    />
  );
}
