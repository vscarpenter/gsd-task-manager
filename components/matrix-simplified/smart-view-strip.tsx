"use client";

import * as React from "react";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import type { SmartView } from "@/lib/filters";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSmartViewOverflow } from "./use-smart-view-overflow";

interface SmartViewStripProps {
  views: SmartView[];
  activeViewId?: string | null;
  onSelectView: (viewId: string) => void;
  onClearView: () => void;
}

/** Shared pill geometry so inline pills, the More button, and the ghost match. */
const PILL_BASE =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

function pillVariant(active: boolean): string {
  return active
    ? "border-accent/40 bg-accent/10 text-foreground"
    : "border-border bg-card text-foreground-muted hover:bg-background-muted hover:text-foreground";
}

const noop = () => {};

export function SmartViewStrip({
  views,
  activeViewId,
  onSelectView,
  onClearView,
}: SmartViewStripProps) {
  const { containerRef, ghostRef, visibleCount } = useSmartViewOverflow(views.length);

  if (views.length === 0) return null;

  const inlineViews = views.slice(0, visibleCount);
  const overflowViews = views.slice(visibleCount);

  return (
    <div ref={containerRef} className="relative">
      {/* role="group" — aria-label on a bare div (generic role) is dropped by AT. */}
      <div className="flex flex-nowrap gap-2" role="group" aria-label="Smart views">
        <SmartViewButton active={!activeViewId} label="All tasks" onClick={onClearView} />
        {inlineViews.map((view) => (
          <SmartViewButton
            key={view.id}
            active={view.id === activeViewId}
            label={view.name}
            icon={view.icon}
            onClick={() => onSelectView(view.id)}
          />
        ))}
        {overflowViews.length > 0 ? (
          <SmartViewOverflowMenu
            views={overflowViews}
            activeViewId={activeViewId}
            onSelectView={onSelectView}
          />
        ) : null}
      </div>
      <SmartViewGhost ref={ghostRef} views={views} />
    </div>
  );
}

/**
 * Hidden measurement row. Renders every pill at natural width so the overflow
 * hook can read stable widths. `inert` keeps its buttons out of the tab order
 * and the accessibility tree; `invisible` (not `hidden`) preserves layout so
 * `offsetWidth` is non-zero. Child order is the contract the hook relies on:
 * [lead, ...views, more]. The `overflow-hidden` wrapper clips the (often
 * wider-than-container) row so it can't trigger a horizontal page scrollbar.
 */
const SmartViewGhost = React.forwardRef<HTMLDivElement, { views: SmartView[] }>(
  function SmartViewGhost({ views }, ref) {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div ref={ref} inert className="invisible flex w-max flex-nowrap gap-2">
          <SmartViewButton active={false} label="All tasks" onClick={noop} />
          {views.map((view) => (
            <SmartViewButton
              key={view.id}
              active={false}
              label={view.name}
              icon={view.icon}
              onClick={noop}
            />
          ))}
          <MoreButton count={views.length} />
        </div>
      </div>
    );
  }
);

function SmartViewButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(PILL_BASE, pillVariant(active))}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}

/** The "More" pill — used both as the menu trigger and inside the ghost. */
const MoreButton = React.forwardRef<
  HTMLButtonElement,
  { count: number; activeLabel?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function MoreButton({ count, activeLabel, className, ...props }, ref) {
  const label = activeLabel
    ? `More smart views (${count}), ${activeLabel} active`
    : `More smart views (${count})`;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(PILL_BASE, pillVariant(Boolean(activeLabel)), className)}
      {...props}
    >
      <span>More</span>
      <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
});

export function SmartViewOverflowMenu({
  views,
  activeViewId,
  onSelectView,
}: {
  views: SmartView[];
  activeViewId?: string | null;
  onSelectView: (viewId: string) => void;
}) {
  const activeView = views.find((view) => view.id === activeViewId);

  // Menu items use aria-current (not the aria-pressed used by inline pills):
  // Radix renders role="menuitem", which does not support aria-pressed.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MoreButton count={views.length} activeLabel={activeView?.name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[60vh] overflow-y-auto">
        {views.map((view) => {
          const isActive = view.id === activeViewId;
          return (
            <DropdownMenuItem
              key={view.id}
              onSelect={() => onSelectView(view.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn("gap-2", isActive && "bg-accent/10 text-foreground")}
            >
              {view.icon ? <span aria-hidden>{view.icon}</span> : null}
              <span className="flex-1">{view.name}</span>
              {isActive ? <CheckIcon className="h-3.5 w-3.5 text-accent" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
