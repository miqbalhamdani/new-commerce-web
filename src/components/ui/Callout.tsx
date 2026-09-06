// Tremor Callout, following the conventions published at tremor.so.
import React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cx } from "@/lib/utils/cx";

const calloutStyles = tv({
  base: "flex flex-col overflow-hidden rounded-md p-4 text-sm",
  variants: {
    variant: {
      error: "bg-danger-soft text-danger-ink",
      warning: "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
      neutral: "bg-raised text-ink-soft",
    },
  },
  defaultVariants: { variant: "neutral" },
});

interface CalloutProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof calloutStyles> {
  title: string;
}

export const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  ({ title, children, className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cx(calloutStyles({ variant }), className)}
      // An error a user needs to act on has to be announced when it appears,
      // not only when they happen to tab past it.
      role={variant === "error" ? "alert" : undefined}
      {...props}
    >
      <div className={cx("flex items-start")}>
        <span className="font-semibold">{title}</span>
      </div>
      {children && <div className={cx("overflow-y-auto pt-1")}>{children}</div>}
    </div>
  ),
);
Callout.displayName = "Callout";
