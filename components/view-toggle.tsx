"use client";

import { usePathname } from "next/navigation";
import { LayoutGridIcon, BarChart3Icon } from "lucide-react";
import { useViewTransition } from "@/lib/use-view-transition";
import { ROUTES, isRouteActive } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Toggle between Matrix and Dashboard views with smooth transitions
 */
export function ViewToggle() {
  const pathname = usePathname();
  const { navigateWithTransition, isPending } = useViewTransition();

  const isMatrix = isRouteActive(pathname, 'HOME');
  const isDashboard = isRouteActive(pathname, 'DASHBOARD');

  return (
    <div className="inline-flex rounded-lg border border-border bg-background-muted p-1">
      <button
        onClick={() => navigateWithTransition(ROUTES.HOME)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          isMatrix && "bg-background text-foreground shadow-sm",
          !isMatrix && "text-foreground-muted hover:text-foreground",
          isPending && "opacity-50 cursor-wait"
        )}
        aria-label="Switch to Matrix view"
        aria-current={isMatrix ? "page" : undefined}
      >
        <LayoutGridIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Matrix</span>
      </button>
      <button
        onClick={() => navigateWithTransition(ROUTES.DASHBOARD)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          isDashboard && "bg-background text-foreground shadow-sm",
          !isDashboard && "text-foreground-muted hover:text-foreground",
          isPending && "opacity-50 cursor-wait"
        )}
        aria-label="Switch to Dashboard view"
        aria-current={isDashboard ? "page" : undefined}
      >
        <BarChart3Icon className="h-4 w-4" />
        <span className="hidden sm:inline">Dashboard</span>
      </button>
    </div>
  );
}
