import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "outline" | "ghost";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-white/10 text-white",
  outline: "border border-white/20 text-white",
  ghost: "bg-transparent text-white"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = ({ className, variant = "default", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
      variantClasses[variant],
      className
    )}
    {...props}
  />
);
