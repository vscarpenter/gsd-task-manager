import * as React from "react";
import { cn } from "@/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({
  className,
  ref,
  ...props
}: LabelProps & { ref?: React.Ref<HTMLLabelElement> }) {
  return (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

Label.displayName = "Label";
