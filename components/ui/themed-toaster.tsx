"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { useIsHydrated } from "@/lib/use-is-hydrated";

// Measured top-bar bottoms: 73px on desktop, 123px at 375px wide, where the
// search field wraps to its own row. The toast sits just below them so it
// never covers the search box or the task counters.
const TOAST_TOP_OFFSET = 80;
const TOAST_MOBILE_TOP_OFFSET = 130;

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const mounted = useIsHydrated();

  const theme = mounted && (resolvedTheme === "dark" || resolvedTheme === "light")
    ? resolvedTheme
    : "system";

  return (
    <Toaster
      richColors
      position="top-center"
      theme={theme}
      offset={{ top: TOAST_TOP_OFFSET }}
      mobileOffset={{ top: TOAST_MOBILE_TOP_OFFSET }}
    />
  );
}
