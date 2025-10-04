import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "subtle" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent hover:bg-accent/90 text-slate-900",
  subtle: "bg-white/5 hover:bg-white/10 text-white",
  ghost: "bg-transparent hover:bg-white/5 text-white"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/80 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
