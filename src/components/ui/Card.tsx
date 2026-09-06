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
      "relative w-full rounded-lg border border-line bg-surface p-6 text-left shadow-xs",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";
