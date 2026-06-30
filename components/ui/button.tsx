import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "subtle" | "ghost" | "destructive";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn-primary active:scale-[0.97]",
  subtle: "btn-secondary active:scale-[0.97]",
  ghost: "btn-ghost active:scale-[0.97]",
  destructive: "btn-danger active:scale-[0.97]"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  className,
  variant = "primary",
  type = "button",
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "btn gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

Button.displayName = "Button";
