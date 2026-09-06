// Tremor Card, following the conventions published at tremor.so.
import React from "react";
import { cx } from "@/lib/utils/cx";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & { asChild?: boolean }
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cx(
      "relative w-full rounded-lg border p-6 text-left shadow-xs",
      "bg-white dark:bg-[#090E1A]",
      "border-gray-200 dark:border-gray-900",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";
