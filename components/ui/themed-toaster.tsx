"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { useIsHydrated } from "@/lib/use-is-hydrated";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const mounted = useIsHydrated();

  const theme = mounted && (resolvedTheme === "dark" || resolvedTheme === "light")
    ? resolvedTheme
    : "system";

  return <Toaster richColors position="top-center" theme={theme} />;
}
