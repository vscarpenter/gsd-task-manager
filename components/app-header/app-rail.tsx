"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3Icon,
  CircleHelpIcon,
  InfoIcon,
  LayoutGridIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { GsdLogo } from "@/components/gsd-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROUTES, isRouteActive, type RouteKey } from "@/lib/routes";
import { useViewTransition } from "@/lib/use-view-transition";
import { cn } from "@/lib/utils";

interface AppRailProps {
  onHelp: () => void;
  onOpenSettings: () => void;
}

interface RailItem {
  routeKey?: RouteKey;
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  isActive?: boolean;
}

export function AppRail({ onHelp, onOpenSettings }: AppRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { navigateWithTransition, isPending } = useViewTransition();

  const workspaceItems: RailItem[] = [
    {
      routeKey: "HOME",
      label: "Matrix",
      icon: LayoutGridIcon,
      isActive: isRouteActive(pathname, "HOME"),
    },
    {
      routeKey: "DASHBOARD",
      label: "Dashboard",
      icon: BarChart3Icon,
      isActive: isRouteActive(pathname, "DASHBOARD"),
    },
  ];

  const utilityItems: RailItem[] = [
    {
      label: "Settings",
      icon: SettingsIcon,
      onSelect: onOpenSettings,
      isActive: isRouteActive(pathname, "SETTINGS"),
    },
    {
      label: "Help",
      icon: CircleHelpIcon,
      onSelect: onHelp,
    },
    {
      label: "About",
      icon: InfoIcon,
      onSelect: () => router.push(ROUTES.ABOUT),
    },
  ];

  const handleSelect = (item: RailItem) => {
    if (item.routeKey) {
      navigateWithTransition(ROUTES[item.routeKey]);
      return;
    }
    item.onSelect?.();
  };

  return (
    <aside className="hidden md:flex md:w-72 md:shrink-0 md:flex-col md:border-r md:border-border/70 md:bg-background/75 md:backdrop-blur-xl">
      <div className="sticky top-0 flex h-screen flex-col px-4 py-5">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background-muted/50 px-3 py-3">
          <GsdLogo className="h-11 w-11 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              GSD Task Manager
            </p>
            <p className="text-xs text-foreground-muted">
              Focus on what matters most
            </p>
          </div>
        </div>

        <nav className="mt-8 space-y-6">
          <RailSectionTitle>Workspace</RailSectionTitle>
          <div className="space-y-1">
            {workspaceItems.map((item) => (
              <RailButton
                key={item.label}
                label={item.label}
                icon={item.icon}
                active={item.isActive}
                disabled={isPending}
                onClick={() => handleSelect(item)}
              />
            ))}
          </div>

          <RailSectionTitle>Utilities</RailSectionTitle>
          <div className="space-y-1">
            {utilityItems.map((item) => (
              <RailButton
                key={item.label}
                label={item.label}
                icon={item.icon}
                active={item.isActive}
                onClick={() => handleSelect(item)}
              />
            ))}
          </div>
        </nav>

        <div className="mt-auto rounded-2xl border border-border/60 bg-background-muted/40 p-3">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-muted">
              Display
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Adjust the interface without leaving your workspace.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function RailSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
      {children}
    </p>
  );
}

function RailButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border"
          : "text-foreground-muted hover:bg-background-muted hover:text-foreground",
        disabled && "cursor-wait opacity-60"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
