"use client";

import { useState, useEffect } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartViewSelector } from "@/components/smart-view-selector";
import { getPinnedSmartViews } from "@/lib/smart-views";
import type { SmartView, FilterCriteria } from "@/lib/filters";
import { cn } from "@/lib/utils";

interface SmartViewPillsProps {
  onSelectView: (criteria: FilterCriteria) => void;
  currentCriteria?: FilterCriteria;
  activeViewId?: string | null;
  onActiveViewChange?: (viewId: string | null) => void;
}

/**
 * SmartViewPills displays pinned smart views as clickable pills in the header
 * with keyboard shortcuts (1-9) and a "more" button to open the full selector
 */
export function SmartViewPills({
  onSelectView,
  currentCriteria,
  activeViewId,
  onActiveViewChange
}: SmartViewPillsProps) {
  const [pinnedViews, setPinnedViews] = useState<SmartView[]>([]);

  const loadPinnedViews = async () => {
    const views = await getPinnedSmartViews();
    setPinnedViews(views);
  };

  useEffect(() => {
    loadPinnedViews();

    // Listen for changes to pinned views (when user pins/unpins from selector)
    const handlePinnedViewsChanged = () => {
      loadPinnedViews();
    };

    window.addEventListener('pinnedViewsChanged', handlePinnedViewsChanged);
    return () => window.removeEventListener('pinnedViewsChanged', handlePinnedViewsChanged);
  }, []);

  const handleSelectView = (view: SmartView) => {
    onSelectView(view.criteria);
    onActiveViewChange?.(view.id);
  };

  const handleClearView = () => {
    onSelectView({});
    onActiveViewChange?.(null);
  };

  if (pinnedViews.length === 0) {
    // If no pinned views, just show the selector button
    return (
      <SmartViewSelector
        onSelectView={onSelectView}
        currentCriteria={currentCriteria}
        onPinnedViewsChange={loadPinnedViews}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
      {/* Pinned view pills */}
      {pinnedViews.map((view, index) => (
        <Button
          key={view.id}
          variant={activeViewId === view.id ? "primary" : "subtle"}
          className="shrink-0 gap-2 h-8 px-3 text-sm"
          onClick={() => handleSelectView(view)}
        >
          <span className="text-base leading-none">{view.icon}</span>
          <span className="text-sm">{view.name}</span>
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-medium opacity-50">
            {index + 1}
          </kbd>
        </Button>
      ))}

      {/* Clear button if a view is active */}
      {activeViewId && (
        <Button
          variant="ghost"
          className="shrink-0 h-8 px-2 text-xs text-foreground-muted hover:text-foreground"
          onClick={handleClearView}
        >
          Clear
          <kbd className="hidden sm:inline-flex ml-1.5 h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-medium opacity-50">
            0
          </kbd>
        </Button>
      )}

      {/* More button - opens full selector */}
      <SmartViewSelector
        onSelectView={onSelectView}
        currentCriteria={currentCriteria}
        onPinnedViewsChange={loadPinnedViews}
        trigger={
          <Button
            variant="subtle"
            className={cn(
              "shrink-0 h-8 w-8 p-0",
              !activeViewId && "ring-2 ring-accent" // Highlight if no view is active
            )}
            aria-label="More smart views"
          >
            <MoreHorizontalIcon className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}
