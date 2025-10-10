"use client";

import { useState, useEffect } from "react";
import { ChevronDownIcon, StarIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSmartViews, deleteSmartView } from "@/lib/smart-views";
import type { SmartView, FilterCriteria } from "@/lib/filters";

interface SmartViewSelectorProps {
  onSelectView: (criteria: FilterCriteria) => void;
  currentCriteria?: FilterCriteria;
}

export function SmartViewSelector({ onSelectView, currentCriteria }: SmartViewSelectorProps) {
  const [views, setViews] = useState<SmartView[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<SmartView | null>(null);

  useEffect(() => {
    loadViews();
  }, []);

  // Clear selection when criteria is externally cleared (e.g., via "Clear All" button)
  useEffect(() => {
    if (currentCriteria && Object.keys(currentCriteria).length === 0 && selectedView) {
      setSelectedView(null);
    }
  }, [currentCriteria, selectedView]);

  const loadViews = async () => {
    const allViews = await getSmartViews();
    setViews(allViews);
  };

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

  const builtInViews = views.filter(v => v.isBuiltIn);
  const customViews = views.filter(v => !v.isBuiltIn);

  return (
    <div className="relative">
      <Button
        variant="subtle"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 text-sm px-3 py-1.5"
      >
        <StarIcon className="h-4 w-4" />
        <span>{selectedView ? selectedView.name : "Smart Views"}</span>
        <ChevronDownIcon className="h-4 w-4" />
      </Button>

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
              {builtInViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => handleSelectView(view)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-background-muted ${
                    selectedView?.id === view.id ? "bg-accent/10 font-medium" : ""
                  }`}
                >
                  <span className="text-lg">{view.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{view.name}</div>
                    {view.description && (
                      <div className="text-xs text-foreground-muted truncate">{view.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Views */}
            {customViews.length > 0 && (
              <>
                <div className="border-t border-card-border" />
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    Custom Views
                  </div>
                  {customViews.map((view) => (
                    <div
                      key={view.id}
                      className={`group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition hover:bg-background-muted ${
                        selectedView?.id === view.id ? "bg-accent/10" : ""
                      }`}
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
                        onClick={(e) => handleDeleteView(view.id, e)}
                        className="shrink-0 rounded p-1 text-foreground-muted opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        aria-label="Delete view"
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
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
