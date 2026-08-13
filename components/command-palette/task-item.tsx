"use client";

import { Command } from "cmdk";
import { CheckIcon } from "lucide-react";
import { quadrants } from "@/lib/quadrants";
import { cn } from "@/lib/utils";
import type { TaskRecord } from "@/lib/types";

interface TaskItemProps {
  task: TaskRecord;
  onSelect: () => void;
}

// Quadrant badge styles — the editorial four-color pigments (dark-aware tokens),
// replacing the old hard-coded system-blue/red/amber Tailwind palette swatches.
const quadrantStyles = {
  "urgent-important": "bg-q1-header text-q1-ink",
  "not-urgent-important": "bg-q2-header text-q2-ink",
  "urgent-not-important": "bg-q3-header text-q3-ink",
  "not-urgent-not-important": "bg-q4-header text-q4-ink",
} as const;

/**
 * Renders a single task item in the command palette
 */
export function TaskItem({ task, onSelect }: TaskItemProps) {
  // The board's own name for the quadrant. Initials of the raw id read as
  // "UI" and "NUNI" — an encoding of the database value, not a label.
  const quadrantLabel = quadrants.find((q) => q.id === task.quadrant)?.title ?? task.quadrant;

  return (
    <Command.Item
      key={task.id}
      value={`task-${task.id}-${task.title}-${task.description}`}
      onSelect={onSelect}
      className={cn(
        "touch-target relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none",
        // Editorial chrome: row highlight is a neutral sunken fill, not a tint.
        "hover:bg-background-muted data-[selected]:bg-background-muted"
      )}
    >
      <CheckIcon
        className={cn(
          "mr-2 h-4 w-4 shrink-0",
          task.completed ? "text-status-success-ink" : "text-foreground-muted/30"
        )}
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium text-foreground truncate">{task.title}</div>
        {task.description && (
          <div className="text-xs text-foreground-muted truncate">{task.description}</div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium",
              quadrantStyles[task.quadrant]
            )}
          >
            {quadrantLabel}
          </span>
          {task.tags.length > 0 && (
            <span className="text-foreground-muted">
              {task.tags
                .slice(0, 2)
                .map((tag) => `#${tag}`)
                .join(" ")}
            </span>
          )}
        </div>
      </div>
    </Command.Item>
  );
}
