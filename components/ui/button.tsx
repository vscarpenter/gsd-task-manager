import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "subtle" | "ghost" | "destructive";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 active:scale-[0.97]",
  subtle: "bg-background-muted hover:bg-background-accent text-foreground border border-border hover:border-border active:scale-[0.97]",
  ghost: "bg-transparent hover:bg-background-muted text-foreground active:scale-[0.97]",
  destructive: "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 hover:shadow-lg hover:shadow-red-700/30 active:scale-[0.97]"
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
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
