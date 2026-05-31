"use client";

import type { SmartView } from "@/lib/filters";
import { cn } from "@/lib/utils";

interface SmartViewStripProps {
  views: SmartView[];
  activeViewId?: string | null;
  onSelectView: (viewId: string) => void;
  onClearView: () => void;
}

export function SmartViewStrip({
  views,
  activeViewId,
  onSelectView,
  onClearView,
}: SmartViewStripProps) {
  if (views.length === 0) return null;

  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Smart views"
    >
      <SmartViewButton active={!activeViewId} label="All tasks" onClick={onClearView} />
      {views.map((view) => (
        <SmartViewButton
          key={view.id}
          active={view.id === activeViewId}
          label={view.name}
          icon={view.icon}
          onClick={() => onSelectView(view.id)}
        />
      ))}
    </div>
  );
}

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
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        active
          ? "border-accent/40 bg-accent/10 text-foreground"
          : "border-border bg-card text-foreground-muted hover:bg-background-muted hover:text-foreground",
      )}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span>{label}</span>
    </button>
  );
}
