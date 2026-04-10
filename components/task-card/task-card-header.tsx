"use client";

import { CheckCircle2Icon, CircleIcon, GripVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { TaskRecord } from "@/lib/types";
import type { SortableAttributes, SortableListeners } from "./types";

export interface TaskCardHeaderProps {
  task: TaskRecord;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (task: TaskRecord) => void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => void;
  sortableAttributes: SortableAttributes;
  sortableListeners: SortableListeners;
}

export function TaskCardHeader({
  task,
  selectionMode,
  isSelected,
  onToggleSelect,
  onToggleComplete,
  sortableAttributes,
  sortableListeners,
}: TaskCardHeaderProps) {
  const completionLabel = task.completed ? "Mark as incomplete" : "Mark as complete";

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {selectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.(task)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 cursor-pointer"
            aria-label={`Select ${task.title}`}
          />
        ) : (
          <button
            type="button"
            className="cursor-grab touch-none shrink-0 rounded p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-background-muted"
            aria-label="Drag to move task"
            {...sortableAttributes}
            {...sortableListeners}
          >
            <GripVerticalIcon className="h-4 w-4 text-foreground-muted" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h3 className={cn(
            "text-[15px] font-semibold leading-snug tracking-tight text-foreground truncate",
            task.completed && "line-through"
          )}>
            {task.title}
          </h3>
          {task.description ? (
            <p className="mt-0.5 text-xs text-foreground-muted line-clamp-2">{task.description}</p>
          ) : null}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onToggleComplete(task, !task.completed)}
            className={cn(
              "button-reset relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200 sm:h-9 sm:w-9",
              task.completed
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 shadow-sm shadow-emerald-500/10 dark:border-emerald-500 dark:text-emerald-400"
                : "border-border bg-background/90 text-foreground-muted shadow-sm shadow-black/[0.04] hover:border-accent hover:text-accent hover:bg-accent/5 hover:scale-105 hover:shadow-accent/10"
            )}
            aria-pressed={task.completed}
            aria-label={completionLabel}
          >
            {task.completed ? (
              <CheckCircle2Icon className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <CircleIcon className="h-4 w-4 shrink-0" />
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
