// Tremor Input, following the conventions published at tremor.so.
"use client";

import React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cx, focusRing, hasErrorInput } from "@/lib/utils/cx";

const inputStyles = tv({
  base: [
    "relative block w-full appearance-none rounded-md border px-3 py-2 text-sm shadow-xs outline-hidden transition",
    "border-line-strong bg-surface text-ink placeholder-ink-muted",
    "hover:border-ink-muted",
    "disabled:cursor-not-allowed disabled:bg-raised disabled:text-ink-muted",
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
        "text-sm leading-none font-medium text-ink",
        className,
      )}
      {...props}
    />
  );
}
