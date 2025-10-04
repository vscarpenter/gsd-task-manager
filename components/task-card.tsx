"use client";

import { CheckIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { formatDueDate, cn } from "@/lib/utils";

interface TaskCardProps {
  task: TaskRecord;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleComplete }: TaskCardProps) {
  const dueLabel = formatDueDate(task.dueDate);

  return (
    <article
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition",
        task.completed ? "opacity-60" : "opacity-100"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug text-slate-900 truncate">
            {task.title}
          </h3>
          {task.description ? (
            <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{task.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onToggleComplete(task, !task.completed)}
          className={cn(
            "button-reset flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase transition",
            task.completed
              ? "border-accent bg-accent/10 text-accent"
              : "border-slate-300 text-slate-600 hover:border-accent hover:text-accent"
          )}
          aria-pressed={task.completed}
          aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
        >
          <CheckIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span className="truncate">Due {dueLabel}</span>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Edit task"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task)}
            className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label="Delete task"
          >
            <Trash2Icon className="h-3 w-3" />
          </button>
        </div>
      </div>
    </article>
  );
}
