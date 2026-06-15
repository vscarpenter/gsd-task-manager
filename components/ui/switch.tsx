"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full transition-colors",
      "border border-border bg-background-accent",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // A toggle reads green when on (reference §03/§06), distinct from the tide
      // action accent reserved for buttons and links.
      "data-[state=checked]:bg-status-success data-[state=checked]:shadow-none",
      "data-[state=unchecked]:bg-background-accent",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[18px] w-[18px] rounded-full bg-card shadow-sm ring-0 transition-transform",
        "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
