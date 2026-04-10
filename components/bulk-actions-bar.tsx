"use client";

import { useState, useRef, useEffect } from "react";
import { CheckCheckIcon, Trash2Icon, XIcon, TagIcon, Grid2x2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QuadrantId } from "@/lib/types";
import { quadrants } from "@/lib/quadrants";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkComplete: () => void;
  onBulkUncomplete: () => void;
  onBulkMoveToQuadrant: (quadrantId: QuadrantId) => void;
  onBulkAddTags: () => void;
}

/**
 * Floating action bar for bulk operations on selected tasks
 */
export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkComplete,
  onBulkUncomplete,
  onBulkMoveToQuadrant,
  onBulkAddTags
}: BulkActionsBarProps) {
  const [moveDropdownOpen, setMoveDropdownOpen] = useState(false);
  const moveDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moveDropdownRef.current && !moveDropdownRef.current.contains(event.target as Node)) {
        setMoveDropdownOpen(false);
      }
    };

    if (moveDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [moveDropdownOpen]);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-bulk-bar-in" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="rounded-2xl border-2 border-border/80 bg-card px-5 py-3 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {/* Selection count */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-accent">
              {selectedCount}
            </span>
            <span className="text-sm text-foreground-muted hidden sm:inline">selected</span>
            <button
              onClick={onClearSelection}
              className="rounded-full p-1 hover:bg-background-muted transition-colors"
              aria-label="Clear selection"
            >
              <XIcon className="h-3.5 w-3.5 text-foreground-muted" />
            </button>
          </div>

          <div className="h-6 w-px bg-border/60" aria-hidden="true" />

          {/* Complete/Uncomplete */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={onBulkComplete}
              className="gap-1.5 px-2.5 py-1.5 text-xs"
              title="Mark selected as complete"
            >
              <CheckCheckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Complete</span>
            </Button>

            <Button
              variant="ghost"
              onClick={onBulkUncomplete}
              className="gap-1.5 px-2.5 py-1.5 text-xs"
              title="Mark selected as incomplete"
            >
              <CheckCheckIcon className="h-4 w-4 opacity-50" />
              <span className="hidden sm:inline">Undo</span>
            </Button>
          </div>

          <div className="h-6 w-px bg-border/60" aria-hidden="true" />

          {/* Move + Tag */}
          <div className="flex items-center gap-1">
            {/* Move to quadrant dropdown */}
            <div className="relative" ref={moveDropdownRef}>
              <Button
                variant="ghost"
                className="gap-1.5 px-2.5 py-1.5 text-xs"
                title="Move to quadrant"
                onClick={() => setMoveDropdownOpen(!moveDropdownOpen)}
              >
                <Grid2x2Icon className="h-4 w-4" />
                <span className="hidden sm:inline">Move</span>
              </Button>

              {moveDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                  <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                    Move to quadrant
                  </p>
                  {quadrants.map(quadrant => (
                    <button
                      key={quadrant.id}
                      onClick={() => {
                        onBulkMoveToQuadrant(quadrant.id);
                        setMoveDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-background-muted transition-colors"
                    >
                      <span className={`h-2 w-2 rounded-full ${quadrant.colorClass}`} />
                      {quadrant.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              onClick={onBulkAddTags}
              className="gap-1.5 px-2.5 py-1.5 text-xs"
              title="Add tags to selected"
            >
              <TagIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Tag</span>
            </Button>
          </div>

          <div className="h-6 w-px bg-border/60" aria-hidden="true" />

          {/* Delete */}
          <Button
            variant="ghost"
            onClick={onBulkDelete}
            className="gap-1.5 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300"
            title="Delete selected tasks"
          >
            <Trash2Icon className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
