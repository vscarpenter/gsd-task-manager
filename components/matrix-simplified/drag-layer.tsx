"use client";

import { DragOverlay } from "@dnd-kit/core";
import type { TaskRecord } from "@/lib/types";

interface DragLayerProps {
  /** The task currently under the cursor's grip, or null when nothing is dragging. */
  task: TaskRecord | null;
  /** Outcome of the last drop, announced once the write has actually settled. */
  statusMessage: string;
}

/**
 * Everything the board renders *about* a drag rather than as part of it: the
 * floating overlay card and the live region that reports the result.
 *
 * The live region is deliberately separate from dnd-kit's own announcements.
 * dnd-kit narrates the gesture and fires the moment the pointer lifts; the write
 * is async and can still fail. Reporting both from one place would mean either
 * announcing success too early or staying silent about failure.
 */
export function DragLayer({ task, statusMessage }: DragLayerProps) {
  return (
    <>
      <DragOverlay dropAnimation={null}>
        {task ? (
          <div
            data-testid="drag-overlay"
            aria-hidden="true"
            className="max-w-sm rounded-lg border border-pane-border bg-card px-4 py-3 shadow-[var(--shadow-elevated)]"
            style={{ cursor: "grabbing" }}
          >
            <p className="truncate text-small font-semibold text-foreground">{task.title}</p>
          </div>
        ) : null}
      </DragOverlay>

      <div role="status" aria-live="polite" data-testid="drag-status" className="sr-only">
        {statusMessage}
      </div>
    </>
  );
}
