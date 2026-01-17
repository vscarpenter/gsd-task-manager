"use client";

import { useState, useEffect } from "react";
import { ChevronDownIcon, StarIcon, Trash2Icon, PinIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSmartViews,
  deleteSmartView,
  pinSmartView,
  unpinSmartView,
  getAppPreferences
} from "@/lib/smart-views";
import type { SmartView, FilterCriteria } from "@/lib/filters";
import { cn } from "@/lib/utils";

interface SmartViewSelectorProps {
  onSelectView: (criteria: FilterCriteria) => void;
  currentCriteria?: FilterCriteria;
  trigger?: React.ReactNode; // Optional custom trigger button
  onPinnedViewsChange?: () => void; // Callback when pinned views change
}

export function SmartViewSelector({
  onSelectView,
  currentCriteria,
  trigger,
  onPinnedViewsChange
}: SmartViewSelectorProps) {
  const [views, setViews] = useState<SmartView[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<SmartView | null>(null);
  const [pinnedViewIds, setPinnedViewIds] = useState<string[]>([]);

  const loadViews = async () => {
    const allViews = await getSmartViews();
    setViews(allViews);

    // Load pinned view IDs
    const prefs = await getAppPreferences();
    setPinnedViewIds(prefs.pinnedSmartViewIds);
  };

  useEffect(() => {
    let cancelled = false;
    const loadInitialViews = async () => {
      const [allViews, prefs] = await Promise.all([
        getSmartViews(),
        getAppPreferences()
      ]);
      if (!cancelled) {
        setViews(allViews);
        setPinnedViewIds(prefs.pinnedSmartViewIds);
      }
    };
    loadInitialViews();
    return () => { cancelled = true; };
  }, []);

  // Clear selection when criteria is externally cleared (e.g., via "Clear All" button)
  // Using a ref to track previous criteria to avoid synchronous setState
  const shouldClearSelection = currentCriteria && Object.keys(currentCriteria).length === 0 && selectedView;
  if (shouldClearSelection) {
    // This will trigger a re-render but won't cause cascading renders
    // since it only runs when the condition changes
    queueMicrotask(() => setSelectedView(null));
  }

  const handleSelectView = (view: SmartView) => {
    setSelectedView(view);
    onSelectView(view.criteria);
    setIsOpen(false);
  };

  const handleDeleteView = async (viewId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm("Are you sure you want to delete this Smart View?")) {
      return;
    }

    try {
      await deleteSmartView(viewId);
      await loadViews();

      // Clear selection if deleted view was selected
      if (selectedView?.id === viewId) {
        setSelectedView(null);
      }
    } catch (error) {
      console.error("Failed to delete Smart View:", error);
      alert("Failed to delete Smart View. It might be a built-in view.");
    }
  };

  const handleClearView = () => {
    setSelectedView(null);
    onSelectView({});
  };

  const handleTogglePin = async (viewId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    const isPinned = pinnedViewIds.includes(viewId);

    try {
      if (isPinned) {
        await unpinSmartView(viewId);
      } else {
        await pinSmartView(viewId);
      }

      // Reload to update pin state
      await loadViews();

      // Notify parent component
      onPinnedViewsChange?.();

      // Dispatch event for SmartViewPills to listen to
      window.dispatchEvent(new CustomEvent('pinnedViewsChanged'));
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      if (error instanceof Error) {
        alert(error.message);
      }
    }
  };

  const builtInViews = views.filter(v => v.isBuiltIn);
  const customViews = views.filter(v => !v.isBuiltIn);

  return (
    <div className="relative">
      {trigger ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="appearance-none bg-transparent border-none p-0 m-0 cursor-pointer"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {trigger}
        </button>
      ) : (
        <Button
          variant="subtle"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2 text-sm px-3 py-1.5"
        >
          <StarIcon className="h-4 w-4" />
          <span>{selectedView ? selectedView.name : "Smart Views"}</span>
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      )}

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-card-border bg-card shadow-lg">
            {/* Built-in Views */}
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Built-in Views
              </div>
              {builtInViews.map((view) => {
                const isPinned = pinnedViewIds.includes(view.id);
                return (
                  <div
                    key={view.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-background-muted",
                      selectedView?.id === view.id && "bg-accent/10"
                    )}
                  >
                    <button
                      onClick={() => handleSelectView(view)}
                      className="flex flex-1 items-center gap-3 text-left min-w-0"
                    >
                      <span className="text-lg">{view.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground">{view.name}</div>
                        {view.description && (
                          <div className="text-xs text-foreground-muted truncate">{view.description}</div>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleTogglePin(view.id, e)}
                      className={cn(
                        "shrink-0 rounded p-1 transition",
                        isPinned
                          ? "text-accent hover:text-accent-hover"
                          : "text-foreground-muted opacity-0 hover:bg-accent/10 hover:text-accent group-hover:opacity-100"
                      )}
                      aria-label={isPinned ? "Unpin from header" : "Pin to header"}
                      title={isPinned ? "Unpin from header" : "Pin to header"}
                    >
                      <PinIcon className={cn("h-4 w-4", isPinned && "fill-current")} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Custom Views */}
            {customViews.length > 0 && (
              <>
                <div className="border-t border-card-border" />
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    Custom Views
                  </div>
                  {customViews.map((view) => {
                    const isPinned = pinnedViewIds.includes(view.id);
                    return (
                      <div
                        key={view.id}
                        className={cn(
                          "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-background-muted",
                          selectedView?.id === view.id && "bg-accent/10"
                        )}
                      >
                        <button
                          onClick={() => handleSelectView(view)}
                          className="flex flex-1 items-center gap-3 text-left min-w-0"
                        >
                          <span className="text-lg">{view.icon || "📌"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground">{view.name}</div>
                            {view.description && (
                              <div className="text-xs text-foreground-muted truncate">{view.description}</div>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={(e) => handleTogglePin(view.id, e)}
                          className={cn(
                            "shrink-0 rounded p-1 transition",
                            isPinned
                              ? "text-accent hover:text-accent-hover"
                              : "text-foreground-muted opacity-0 hover:bg-accent/10 hover:text-accent group-hover:opacity-100"
                          )}
                          aria-label={isPinned ? "Unpin from header" : "Pin to header"}
                          title={isPinned ? "Unpin from header" : "Pin to header"}
                        >
                          <PinIcon className={cn("h-4 w-4", isPinned && "fill-current")} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteView(view.id, e)}
                          className="shrink-0 rounded p-1 text-foreground-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          aria-label="Delete view"
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Clear Selection */}
            {selectedView && (
              <>
                <div className="border-t border-card-border" />
                <div className="p-2">
                  <button
                    onClick={handleClearView}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground-muted transition hover:bg-background-muted hover:text-foreground"
                  >
                    Clear Selection
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
