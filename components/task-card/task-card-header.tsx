"use client";

import { CheckCircle2Icon, CircleIcon, GripVerticalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { TaskRecord } from "@/lib/types";
import type { RedesignQuadrantKey } from "@/lib/quadrants";
import { quadrantAccent } from "@/lib/quadrant-accent";
import type { SortableAttributes, SortableListeners } from "./types";
import { TaskDescription } from "@/components/task-description";

function rdKeyFor(task: TaskRecord): RedesignQuadrantKey {
  if (task.urgent && task.important) return "q1";
  if (!task.urgent && task.important) return "q2";
  if (task.urgent) return "q3";
  return "q4";
}

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
  const accent = quadrantAccent(rdKeyFor(task));
  const accentSoft = quadrantAccent(rdKeyFor(task), 0.5);

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
            "text-[15px] font-medium leading-snug tracking-tight text-foreground truncate",
            task.completed && "line-through"
          )}>
            {task.title}
          </h3>
          {task.description ? (
            <p className="mt-0.5 text-xs text-foreground-muted line-clamp-2">
              <TaskDescription description={task.description} />
            </p>
          ) : null}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onToggleComplete(task, !task.completed)}
            className={cn(
              "button-reset relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 sm:h-9 sm:w-9",
              task.completed
                ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 shadow-sm shadow-emerald-500/10 dark:border-emerald-500 dark:text-emerald-400"
                : "bg-background/90 text-foreground-muted shadow-sm shadow-black/[0.04] hover:scale-105"
            )}
            style={
              task.completed
                ? undefined
                : { borderColor: accentSoft }
            }
            onMouseEnter={(e) => {
              if (!task.completed) {
                e.currentTarget.style.borderColor = accent;
                e.currentTarget.style.color = accent;
              }
            }}
            onMouseLeave={(e) => {
              if (!task.completed) {
                e.currentTarget.style.borderColor = accentSoft;
                e.currentTarget.style.color = "";
              }
            }}
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
