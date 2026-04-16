"use client";

import { usePathname } from "next/navigation";
import {
  LayoutGridIcon,
  BarChart3Icon,
  type LucideIcon,
} from "lucide-react";
import { useViewTransition } from "@/lib/use-view-transition";
import { ROUTES, isRouteActive, type RouteKey } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface ViewTab {
  routeKey: RouteKey;
  label: string;
  icon: LucideIcon;
  ariaLabel: string;
}

const TABS: ViewTab[] = [
  { routeKey: "HOME", label: "Matrix", icon: LayoutGridIcon, ariaLabel: "Switch to Matrix view" },
  { routeKey: "DASHBOARD", label: "Dashboard", icon: BarChart3Icon, ariaLabel: "Switch to Dashboard view" },
];

/**
 * Top-level view switcher for the primary workspace screens.
 * Uses View Transitions API for smooth route animations.
 */
interface ViewToggleProps {
  className?: string;
  showLabelsOnMobile?: boolean;
}

export function ViewToggle({ className, showLabelsOnMobile = false }: ViewToggleProps) {
  const pathname = usePathname();
  const { navigateWithTransition, isPending } = useViewTransition();

  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-border bg-background-muted p-1",
        className
      )}
    >
      {TABS.map((tab) => {
        const isActive = isRouteActive(pathname, tab.routeKey);
        const Icon = tab.icon;
        return (
          <button
            key={tab.routeKey}
            type="button"
            onClick={() => navigateWithTransition(ROUTES[tab.routeKey])}
            disabled={isPending}
            className={cn(
              "inline-flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-foreground-muted hover:bg-background/60 hover:text-foreground",
              isPending && "opacity-50 cursor-wait"
            )}
            aria-label={tab.ariaLabel}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            <span className={cn(!showLabelsOnMobile && "hidden sm:inline")}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
