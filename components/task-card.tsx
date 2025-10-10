"use client";

import { memo, useMemo } from "react";
import { CheckIcon, GripVerticalIcon, PencilIcon, Trash2Icon, RepeatIcon, AlertCircleIcon, TagIcon } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskRecord } from "@/lib/types";
import { formatDueDate, cn, isOverdue, isDueToday } from "@/lib/utils";

interface TaskCardProps {
  task: TaskRecord;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
}

function TaskCardComponent({ task, onEdit, onDelete, onToggleComplete }: TaskCardProps) {
  // Memoize expensive computations
  const dueLabel = useMemo(() => formatDueDate(task.dueDate), [task.dueDate]);
  const taskIsOverdue = useMemo(() => !task.completed && isOverdue(task.dueDate), [task.completed, task.dueDate]);
  const taskIsDueToday = useMemo(() => !task.completed && isDueToday(task.dueDate), [task.completed, task.dueDate]);
  const { completedSubtasks, totalSubtasks } = useMemo(() => ({
    completedSubtasks: task.subtasks.filter(st => st.completed).length,
    totalSubtasks: task.subtasks.length
  }), [task.subtasks]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition",
        task.completed ? "opacity-60" : "opacity-100",
        isDragging && "cursor-grabbing",
        taskIsOverdue ? "border-red-300 bg-red-50/50" : "border-card-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <button
            type="button"
            className="cursor-grab touch-none shrink-0 rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-background-muted"
            aria-label="Drag to move task"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="h-4 w-4 text-foreground-muted" />
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-snug text-foreground truncate">
              {task.title}
            </h3>
            {task.description ? (
              <p className="mt-0.5 text-xs text-foreground-muted line-clamp-2">{task.description}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleComplete(task, !task.completed)}
          className={cn(
            "button-reset flex shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase transition",
            "h-7 w-7 md:h-7 md:w-7",
            "sm:h-9 sm:w-9",
            task.completed
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-foreground-muted hover:border-accent hover:text-accent"
          )}
          aria-pressed={task.completed}
          aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
        >
          <CheckIcon className="h-4 w-4 sm:h-4 sm:w-4" />
        </button>
      </div>

      {/* Tags */}
      {task.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
            >
              <TagIcon className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Subtasks progress */}
      {totalSubtasks > 0 ? (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex-1 h-1.5 rounded-full bg-background-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-foreground-muted">
            {completedSubtasks}/{totalSubtasks}
          </span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-xs text-foreground-muted">
        <div className="flex items-center gap-2">
          {taskIsOverdue ? (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <AlertCircleIcon className="h-3 w-3" />
              Overdue
            </span>
          ) : taskIsDueToday ? (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <AlertCircleIcon className="h-3 w-3" />
              Due today
            </span>
          ) : (
            <span className="truncate">Due {dueLabel}</span>
          )}
          {task.recurrence !== "none" ? (
            <span className="flex items-center gap-1 text-accent" title={`Recurs ${task.recurrence}`}>
              <RepeatIcon className="h-3 w-3" />
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 transition sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="rounded p-2 sm:px-1.5 sm:py-0.5 hover:bg-background-muted hover:text-foreground touch-manipulation"
            aria-label="Edit task"
          >
            <PencilIcon className="h-4 w-4 sm:h-3 sm:w-3" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task)}
            className="rounded p-2 sm:px-1.5 sm:py-0.5 text-red-600 hover:bg-red-50 hover:text-red-700 touch-manipulation"
            aria-label="Delete task"
          >
            <Trash2Icon className="h-4 w-4 sm:h-3 sm:w-3" />
          </button>
        </div>
      </div>
    </article>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const TaskCard = memo(TaskCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.description === nextProps.task.description &&
    prevProps.task.completed === nextProps.task.completed &&
    prevProps.task.urgent === nextProps.task.urgent &&
    prevProps.task.important === nextProps.task.important &&
    prevProps.task.dueDate === nextProps.task.dueDate &&
    prevProps.task.recurrence === nextProps.task.recurrence &&
    prevProps.task.updatedAt === nextProps.task.updatedAt &&
    prevProps.task.tags.length === nextProps.task.tags.length &&
    prevProps.task.subtasks.length === nextProps.task.subtasks.length &&
    JSON.stringify(prevProps.task.tags) === JSON.stringify(nextProps.task.tags) &&
    JSON.stringify(prevProps.task.subtasks) === JSON.stringify(nextProps.task.subtasks)
  );
});
