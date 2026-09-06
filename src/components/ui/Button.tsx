// Tremor Button, following the conventions published at tremor.so.
"use client";

import { Slot } from "@radix-ui/react-slot";
import { RiLoader2Fill } from "@remixicon/react";
import { tv, type VariantProps } from "tailwind-variants";
import { cx, focusRing } from "@/lib/utils/cx";

const buttonStyles = tv({
  base: [
    "relative inline-flex items-center justify-center gap-x-2 whitespace-nowrap rounded-md border px-3 py-2 text-center text-sm font-medium shadow-xs transition-all duration-100 ease-in-out",
    "disabled:pointer-events-none disabled:shadow-none",
    ...focusRing,
  ],
  variants: {
    variant: {
      primary: [
        "border-transparent text-white dark:text-white",
        "bg-blue-500 dark:bg-blue-500",
        "hover:bg-blue-600 dark:hover:bg-blue-600",
        "disabled:bg-blue-300 disabled:text-white",
        "dark:disabled:bg-blue-800 dark:disabled:text-blue-400",
      ],
      secondary: [
        "border-gray-300 dark:border-gray-800",
        "text-gray-900 dark:text-gray-50",
        "bg-white dark:bg-gray-950",
        "hover:bg-gray-50 dark:hover:bg-gray-900/60",
        "disabled:text-gray-400 dark:disabled:text-gray-600",
      ],
      ghost: [
        "shadow-none border-transparent",
        "text-gray-900 dark:text-gray-50",
        "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-900/60",
        "disabled:text-gray-400 dark:disabled:text-gray-600",
      ],
      destructive: [
        "text-white border-transparent",
        "bg-red-600 dark:bg-red-700",
        "hover:bg-red-700 dark:hover:bg-red-600",
        "disabled:bg-red-300 disabled:text-white",
      ],
    },
  },
  defaultVariants: { variant: "primary" },
});

interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonStyles> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingText?: string;
}

export function Button({
  asChild,
  isLoading = false,
  loadingText,
  className,
  disabled,
  variant,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cx(buttonStyles({ variant }), className)}
      // A loading button must not be clickable twice. Submitting a login form
      // twice creates two sessions, and the second silently rotates the first.
      disabled={disabled || isLoading}
      // aria-busy is what tells a screen reader something is happening; the
      // spinner alone is invisible to it.
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="pointer-events-none flex shrink-0 items-center justify-center gap-1.5">
          <RiLoader2Fill className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>{loadingText ? loadingText : children}</span>
        </span>
      ) : (
        children
      )}
    </Component>
  );
}
