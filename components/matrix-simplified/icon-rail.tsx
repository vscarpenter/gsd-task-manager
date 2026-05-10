"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  CircleHelpIcon,
  InfoIcon,
  LayoutGridIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { GsdLogo } from "@/components/gsd-logo";
import { ROUTES, isRouteActive, type RouteKey } from "@/lib/routes";
import { useViewTransition } from "@/lib/use-view-transition";
import { readRailCollapsed, writeRailCollapsed } from "@/lib/preferences/icon-rail";
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
  const [collapsed, setCollapsed] = useState<boolean>(readRailCollapsed);

  useEffect(() => {
    writeRailCollapsed(collapsed);
  }, [collapsed]);

  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex md:shrink-0 md:flex-col md:items-stretch md:overflow-hidden md:border-r md:border-border/70 md:bg-background md:transition-[width] md:duration-150 md:ease-out",
          collapsed ? "md:w-[60px]" : "md:w-[180px]"
        )}
        aria-label="Primary navigation"
      >
        <div className="sticky top-0 flex h-screen flex-col gap-1 px-2 py-3.5">
          <div className="mb-2.5 flex h-8 items-center gap-2.5 px-1.5" title="GSD">
            <GsdLogo size={28} />
            <span
              className={cn(
                "rd-serif whitespace-nowrap text-[15px] tracking-tight text-foreground transition-opacity duration-150",
                collapsed ? "opacity-0" : "opacity-100"
              )}
            >
              GSD
            </span>
          </div>
          <div className="my-1 h-px w-6 bg-border/70" aria-hidden />
          {PRIMARY.map((item) => (
            <RailButton
              key={item.routeKey}
              label={item.label}
              icon={item.icon}
              active={isRouteActive(pathname, item.routeKey)}
              disabled={isPending}
              collapsed={collapsed}
              onClick={() => navigateWithTransition(ROUTES[item.routeKey])}
            />
          ))}
          <div className="flex-1" />
          <RailButton
            label="Help · Keyboard shortcuts"
            icon={CircleHelpIcon}
            collapsed={collapsed}
            onClick={onHelp}
          />
          <RailButton
            label={toggleLabel}
            icon={collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon}
            collapsed={collapsed}
            onClick={() => setCollapsed((prev) => !prev)}
          />
        </div>
      </aside>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border/70 bg-background/95 px-2 py-1.5 backdrop-blur md:hidden"
        aria-label="Primary navigation (mobile)"
      >
        {PRIMARY.map((item) => (
          <RailButton
            key={item.routeKey}
            label={item.label}
            icon={item.icon}
            active={isRouteActive(pathname, item.routeKey)}
            disabled={isPending}
            onClick={() => navigateWithTransition(ROUTES[item.routeKey])}
            mobile
          />
        ))}
        <RailButton label="Help" icon={CircleHelpIcon} onClick={onHelp} mobile />
      </nav>
    </>
  );
}

function RailButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  collapsed = false,
  onClick,
  mobile = false,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  onClick: () => void;
  mobile?: boolean;
}) {
  if (mobile) {
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

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 w-full items-center gap-3 rounded-xl pl-2.5 pr-3 text-body transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
        active
          ? "text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-full before:bg-accent before:content-['']"
          : "text-foreground-muted hover:bg-background-muted/60 hover:text-foreground",
        disabled && "cursor-wait opacity-60"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span
        className={cn(
          "whitespace-nowrap transition-opacity duration-150",
          collapsed ? "opacity-0" : "opacity-100"
        )}
      >
        {label}
      </span>
    </button>
  );
}
