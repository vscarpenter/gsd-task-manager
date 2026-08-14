"use client";

import { useEffect, useState } from "react";
import { CheckIcon, ChevronRightIcon, CircleIcon, GripVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { TaskRecord } from "@/lib/types";
import type { SortableAttributes, SortableListeners } from "./types";
import { TaskDescription } from "@/components/task-description";

export interface TaskCardHeaderProps {
  task: TaskRecord;
  /** CSS var for the task's quadrant pigment, e.g. "var(--q1)". */
  accentVar: string;
  /** Reserves room for the absolutely-positioned overdue badge so a long title
   *  truncates instead of rendering underneath it. */
  reserveBadgeSpace?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  onInspect?: (task: TaskRecord) => void;
  sortableAttributes: SortableAttributes;
  sortableListeners: SortableListeners;
}

export function TaskCardHeader({
  task,
  accentVar,
  reserveBadgeSpace,
  selectionMode,
  isSelected,
  onToggleSelect,
  onToggleComplete,
  onInspect,
  sortableAttributes,
  sortableListeners,
}: TaskCardHeaderProps) {
  const completionLabel = task.completed ? "Mark as incomplete" : "Mark as complete";
  const [isTogglingComplete, setIsTogglingComplete] = useState(false);
  const [locallyCompletedTaskId, setLocallyCompletedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!locallyCompletedTaskId) return;

    const timer = window.setTimeout(() => {
      setLocallyCompletedTaskId((current) =>
        current === locallyCompletedTaskId ? null : current
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [locallyCompletedTaskId]);

  const handleToggleComplete = async () => {
    if (isTogglingComplete) return;

    setIsTogglingComplete(true);
    try {
      const completedNext = !task.completed;
      await onToggleComplete(task, completedNext);
      setLocallyCompletedTaskId(completedNext ? task.id : null);
    } finally {
      setIsTogglingComplete(false);
    }
  };

  // Reserve the pop for a successful local completion. Initial data and remote
  // sync can render a task as completed, but those are state observations rather
  // than the user's completion moment.
  const justCompleted = task.completed && locallyCompletedTaskId === task.id;
  const checkIconClassName = cn("h-4 w-4 shrink-0", justCompleted && "animate-check-pop");

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <CardLeadingControl
          task={task}
          selectionMode={selectionMode}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
          sortableAttributes={sortableAttributes}
          sortableListeners={sortableListeners}
        />
        <div
          className={cn(
            "min-w-0 flex-1",
            reserveBadgeSpace && "pr-24"
          )}
        >
          <h3 className={cn(
            "text-[14.5px] font-semibold leading-[1.4] tracking-[-0.005em]",
            !onInspect && "truncate",
            // Strike-through alone leaves the title at full contrast; in dark
            // mode that makes a completed card read as an active one. The
            // recede is what carries the state.
            task.completed ? "text-foreground-muted line-through" : "text-foreground"
          )}>
            {onInspect ? (
              <button
                data-testid="view-task-details"
                type="button"
                onClick={(event) => {
                  // Safari does not focus buttons on pointer click by default;
                  // make the title the inspector's explicit return target.
                  event.currentTarget.focus();
                  onInspect(task);
                }}
                aria-label={`View details for ${task.title}`}
                aria-haspopup="dialog"
                className="button-reset touch-target -mx-1 inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-xs px-1 text-left transition-[background-color,color] hover:bg-background-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <span className="min-w-0 truncate">{task.title}</span>
                <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden="true" />
              </button>
            ) : task.title}
          </h3>
          {task.description ? (
            <p className="mt-[3px] text-[12.5px] leading-[1.55] text-foreground-muted line-clamp-2">
              <TaskDescription description={task.description} />
            </p>
          ) : null}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid="complete-task"
            type="button"
            onClick={handleToggleComplete}
            disabled={isTogglingComplete}
            // Completed disc fills with the task's quadrant pigment (reference §06),
            // applied inline because the var is per-quadrant; the paper-colored check
            // contrasts the pigment in both light and dark themes.
            style={task.completed ? { backgroundColor: accentVar, borderColor: accentVar } : undefined}
            className={cn(
              // active:scale-95 gives the completion toggle — the card's key
              // moment — a tactile down-press to pair with the check-pop on release.
              // One size at every breakpoint (34px): the disc is the card's
              // primary action and a responsive step made it drift against the
              // fixed 12px card padding.
              "button-reset touch-target relative inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-95",
              task.completed
                ? "shadow-sm"
                : "border-border bg-card text-ink-hint hover:border-accent hover:text-accent hover:bg-accent/5 hover:scale-105"
            )}
            aria-pressed={task.completed}
            aria-busy={isTogglingComplete}
            aria-label={completionLabel}
          >
            {task.completed ? (
              // Color lives on the icon: the button's `button-reset` (unlayered
              // color: inherit) would neutralize a text-color class on the button.
              <CheckIcon
                style={{ color: "var(--paper)" }}
                className={checkIconClassName}
              />
            ) : (
              <>
                <CircleIcon className="h-[15px] w-[15px] shrink-0" />
                <span
                  aria-hidden="true"
                  className="absolute h-1.5 w-1.5 rounded-full bg-current opacity-0 transition-opacity duration-200 group-hover:opacity-40"
                />
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{completionLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * The card's left gutter: a selection checkbox in selection mode, otherwise the
 * drag grip.
 */
function CardLeadingControl({
  task,
  selectionMode,
  isSelected,
  onToggleSelect,
  sortableAttributes,
  sortableListeners,
}: Pick<
  TaskCardHeaderProps,
  "task" | "selectionMode" | "isSelected" | "onToggleSelect" | "sortableAttributes" | "sortableListeners"
>) {
  return selectionMode ? (
          <label className="touch-target mt-0.5 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(task)}
              className="h-5 w-5 shrink-0 cursor-pointer rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2"
              aria-label={`Select ${task.title}`}
            />
          </label>
        ) : (
          // Floats over the card's left gutter instead of holding a column, so
          // titles start flush. Visibility (not hit-testing) is what's gated:
          // gating pointer-events too would be a no-op for a real mouse — you
          // cannot reach the grip without hovering the card that reveals it —
          // while breaking any tool that asserts actionability before moving
          // the pointer, Playwright's `hover()` included.
          <button
            type="button"
            // Sized to the lane, which is narrow: the spine ends 4px in and the
            // card's content edge is at 25px, leaving 21px. A 24px button at
            // left-0 could not fit, so it painted over both neighbours — the
            // spine vanished under its opaque fill for 24px, and its right edge
            // landed on the title's first glyph ("Deepsec" read as ")eepsec").
            // 16px inset 6px leaves 3px of air before the spine and 2px after,
            // and the fill is gone: a transparent grip cannot erase what it
            // floats over, so the next rounding error is cosmetic, not a bug.
            // Coarse pointers drop the float entirely — see globals.css.
            className="task-card-grip touch-target absolute left-[6px] top-3 z-10 flex h-5 w-4 cursor-grab touch-none items-center justify-center rounded-icon opacity-0 transition-opacity hover:bg-background-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:static [@media(pointer:coarse)]:opacity-100"
            aria-label="Drag to move task"
            {...sortableAttributes}
            {...sortableListeners}
          >
            <GripVerticalIcon className="h-4 w-4 text-foreground-muted" />
          </button>
  );
}
