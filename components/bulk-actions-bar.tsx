"use client";

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
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
      <div className="rounded-full border border-border bg-card px-6 py-3 shadow-xl">
        <div className="flex items-center gap-4">
          {/* Selection count */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {selectedCount} selected
            </span>
            <button
              onClick={onClearSelection}
              className="rounded-full p-1 hover:bg-background-muted transition-colors"
              aria-label="Clear selection"
            >
              <XIcon className="h-4 w-4 text-foreground-muted" />
            </button>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Complete/Uncomplete */}
            <Button
              variant="ghost"
              onClick={onBulkComplete}
              className="gap-2 px-3 py-1.5 text-xs"
              title="Mark selected as complete"
            >
              <CheckCheckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Complete</span>
            </Button>

            <Button
              variant="ghost"
              onClick={onBulkUncomplete}
              className="gap-2 px-3 py-1.5 text-xs"
              title="Mark selected as incomplete"
            >
              <CheckCheckIcon className="h-4 w-4 opacity-50" />
              <span className="hidden sm:inline">Uncomplete</span>
            </Button>

            {/* Move to quadrant dropdown */}
            <div className="relative group">
              <Button
                variant="ghost"
                className="gap-2 px-3 py-1.5 text-xs"
                title="Move to quadrant"
              >
                <Grid2x2Icon className="h-4 w-4" />
                <span className="hidden sm:inline">Move</span>
              </Button>

              {/* Dropdown menu */}
              <div className="absolute bottom-full left-0 mb-2 hidden w-48 rounded-lg border border-border bg-card shadow-lg group-hover:block">
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-semibold text-foreground-muted">
                    Move to quadrant
                  </p>
                  {quadrants.map(quadrant => (
                    <button
                      key={quadrant.id}
                      onClick={() => onBulkMoveToQuadrant(quadrant.id)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-background-muted transition-colors"
                    >
                      {quadrant.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Add tags */}
            <Button
              variant="ghost"
              onClick={onBulkAddTags}
              className="gap-2 px-3 py-1.5 text-xs"
              title="Add tags to selected"
            >
              <TagIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Tag</span>
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              onClick={onBulkDelete}
              className="gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              title="Delete selected tasks"
            >
              <Trash2Icon className="h-4 w-4" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
