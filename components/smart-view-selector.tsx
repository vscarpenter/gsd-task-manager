"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronDownIcon, StarIcon, Trash2Icon, PinIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  getSmartViews,
  deleteSmartView,
  pinSmartView,
  unpinSmartView,
  getAppPreferences
} from "@/lib/smart-views";
import type { SmartView, FilterCriteria } from "@/lib/filters";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logger";

const logger = createLogger("SMART_VIEWS");

interface SmartViewSelectorProps {
  onSelectView: (criteria: FilterCriteria) => void;
  currentCriteria?: FilterCriteria;
  trigger?: ReactNode; // Optional custom trigger element
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

    // Capture view data for undo before deleting
    const viewToDelete = views.find(v => v.id === viewId);
    if (!viewToDelete) return;

    try {
      await deleteSmartView(viewId);
      await loadViews();

      // Clear selection if deleted view was selected
      if (selectedView?.id === viewId) {
        setSelectedView(null);
      }

      toast.success(`Deleted "${viewToDelete.name}"`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const db = await import("@/lib/db").then(m => m.getDb());
              await db.smartViews.put(viewToDelete);
              await loadViews();
              onPinnedViewsChange?.();
              window.dispatchEvent(new CustomEvent('pinnedViewsChanged'));
              toast.success("Delete undone");
            } catch (undoError) {
              logger.error("Failed to undo delete", undoError instanceof Error ? undoError : new Error(String(undoError)));
              toast.error("Failed to undo delete");
            }
          },
        },
      });
    } catch (error) {
      logger.error("Failed to delete Smart View", error instanceof Error ? error : new Error(String(error)));
      toast.error("Failed to delete Smart View. It might be a built-in view.");
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
      logger.error("Failed to toggle pin", error instanceof Error ? error : new Error(String(error)));
      toast.error(error instanceof Error ? error.message : "Failed to update pinned views");
    }
  };

  const builtInViews = views.filter(v => v.isBuiltIn);
  const customViews = views.filter(v => !v.isBuiltIn);

  const renderViewItem = (
    view: SmartView,
    options?: { showDelete?: boolean }
  ) => {
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
        {options?.showDelete && (
          <button
            onClick={(e) => handleDeleteView(view.id, e)}
            className="shrink-0 rounded p-1 text-foreground-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
            aria-label="Delete view"
          >
            <Trash2Icon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  const toggleOpen = () => {
    setIsOpen((current) => !current);
  };

  const customTrigger = trigger && isValidElement(trigger)
    ? (trigger as ReactElement<Record<string, unknown> & {
        onClick?: (event: ReactMouseEvent) => void;
      }>)
    : null;

  const triggerElement = customTrigger
    ? cloneElement(customTrigger, {
          onClick: (event: ReactMouseEvent) => {
            customTrigger.props.onClick?.(event);
            if (!event.defaultPrevented) {
              toggleOpen();
            }
          },
          "aria-expanded": isOpen,
          "aria-haspopup": "listbox",
        }
      )
    : null;

  return (
    <div className="relative">
      {trigger ? (
        triggerElement ?? (
          <span
            className="inline-flex cursor-pointer"
            onClick={toggleOpen}
            onKeyDown={(event: ReactKeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleOpen();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Select smart view"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            {trigger}
          </span>
        )
      ) : (
        <Button
          variant="subtle"
          onClick={toggleOpen}
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
            {/* Header with explanation */}
            <div className="px-5 pt-3 pb-1 flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Smart Views</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-3.5 w-3.5 text-foreground-muted cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p>Smart Views are saved filter combinations. Pin your favorites to the header for quick access.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* Built-in Views */}
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Built-in
              </div>
              {builtInViews.map((view) => renderViewItem(view))}
            </div>

            {/* Custom Views */}
            {customViews.length > 0 && (
              <>
                <div className="border-t border-card-border" />
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    Custom Views
                  </div>
                  {customViews.map((view) => renderViewItem(view, { showDelete: true }))}
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
