"use client";

import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  CircleHelpIcon,
  InfoIcon,
  LayoutGridIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { GsdLogo } from "@/components/gsd-logo";
import { ROUTES, isRouteActive, type RouteKey } from "@/lib/routes";
import { useViewTransition } from "@/lib/use-view-transition";
import { cn } from "@/lib/utils";

interface IconRailProps {
  onHelp: () => void;
}

interface RailItem {
  routeKey: RouteKey;
  label: string;
  icon: LucideIcon;
}

const PRIMARY: RailItem[] = [
  { routeKey: "HOME", label: "Matrix", icon: LayoutGridIcon },
  { routeKey: "DASHBOARD", label: "Dashboard", icon: BarChart3Icon },
  { routeKey: "SETTINGS", label: "Settings", icon: SettingsIcon },
  { routeKey: "ABOUT", label: "About", icon: InfoIcon },
];

export function IconRail({ onHelp }: IconRailProps) {
  const pathname = usePathname();
  const { navigateWithTransition, isPending } = useViewTransition();

  return (
    <aside
      className="hidden md:flex md:w-[60px] md:shrink-0 md:flex-col md:items-center md:border-r md:border-border/70 md:bg-background"
      aria-label="Primary navigation"
    >
      <div className="sticky top-0 flex h-screen flex-col items-center gap-1 py-3.5">
        <div className="mb-2.5 flex h-8 w-8 items-center justify-center" title="GSD">
          <GsdLogo size={28} />
        </div>
        <div className="my-1 h-px w-6 bg-border/70" aria-hidden />
        {PRIMARY.map((item) => (
          <RailButton
            key={item.routeKey}
            label={item.label}
            icon={item.icon}
            active={isRouteActive(pathname, item.routeKey)}
            disabled={isPending}
            onClick={() => navigateWithTransition(ROUTES[item.routeKey])}
          />
        ))}
        <div className="flex-1" />
        <RailButton label="Help · Keyboard shortcuts" icon={CircleHelpIcon} onClick={onHelp} />
      </div>
    </aside>
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
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
        active
          ? "bg-background-muted text-foreground"
          : "text-foreground-muted hover:bg-background-muted/60 hover:text-foreground",
        disabled && "cursor-wait opacity-60"
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
