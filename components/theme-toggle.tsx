"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsHydrated } from "@/lib/use-is-hydrated";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsHydrated();

  const isDark = theme !== "light";

  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground-muted"
        data-testid="theme-toggle-placeholder"
      >
        <SunIcon className="h-5 w-5" />
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="subtle"
          aria-label="Toggle theme"
          className="h-10 w-10 p-0"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Switch to {isDark ? "Light" : "Dark"} Mode</p>
      </TooltipContent>
    </Tooltip>
  );
}
