import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "outline" | "ghost" | "accent";

const variantClasses: Record<BadgeVariant, string> = {
  default: "badge-neutral",
  outline: "border-border bg-transparent text-foreground",
  ghost: "bg-transparent text-foreground-muted",
  accent: "badge-accent"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = ({ className, variant = "default", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
      "badge",
      variantClasses[variant],
      className
    )}
    {...props}
  />
);
