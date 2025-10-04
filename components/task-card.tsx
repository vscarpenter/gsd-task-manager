"use client";

import { CheckIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { formatDueDate, formatRelative, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TaskCardProps {
  task: TaskRecord;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
}

export function TaskCard({ task, onEdit, onDelete, onToggleComplete }: TaskCardProps) {
  const dueLabel = formatDueDate(task.dueDate);
  const relative = formatRelative(task.dueDate);

  return (
    <article
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4 shadow-sm transition",
        task.completed ? "opacity-60" : "opacity-100"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-tight text-white">
            {task.title}
          </h3>
          {task.description ? (
            <p className="text-sm text-slate-300">{task.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onToggleComplete(task, !task.completed)}
          className={cn(
            "button-reset flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold uppercase transition",
            task.completed
              ? "border-accent/80 bg-accent/20 text-accent"
              : "border-white/15 text-slate-200 hover:border-accent/70 hover:text-accent"
          )}
          aria-pressed={task.completed}
          aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
        >
          <CheckIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-quadrant-focus/20 text-quadrant-focus">
          {task.urgent ? "Urgent" : "Not Urgent"}
        </Badge>
        <Badge className="bg-quadrant-schedule/20 text-quadrant-schedule">
          {task.important ? "Important" : "Not Important"}
        </Badge>
        <Badge variant="outline">{task.quadrant.replace(/-/g, " ")}</Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          Due {dueLabel}
          {relative ? <span className="text-slate-500"> - {relative}</span> : null}
        </span>
        <span>Updated {formatRelative(task.updatedAt)}</span>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 opacity-0 transition group-hover:opacity-100">
        <Button variant="ghost" className="px-3" onClick={() => onEdit(task)}>
          <PencilIcon className="mr-1 h-4 w-4" /> Edit
        </Button>
        <Button
          variant="ghost"
          className="px-3 text-red-300 hover:text-red-100"
          onClick={() => onDelete(task)}
        >
          <Trash2Icon className="mr-1 h-4 w-4" /> Delete
        </Button>
      </div>
    </article>
  );
}
