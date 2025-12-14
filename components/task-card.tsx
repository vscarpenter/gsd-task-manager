"use client";

import { memo } from "react";
import { CheckIcon, GripVerticalIcon, PencilIcon, Trash2Icon, RepeatIcon, AlertCircleIcon, TagIcon, LockIcon, LinkIcon, Share2Icon, CopyIcon } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskRecord } from "@/lib/types";
import { formatDueDate, cn, isOverdue, isDueToday } from "@/lib/utils";
import { getUncompletedBlockingTasks, getBlockedTasks } from "@/lib/dependencies";

interface TaskCardProps {
  task: TaskRecord;
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (task: TaskRecord) => void;
  taskRef?: (el: HTMLElement | null) => void;
  isHighlighted?: boolean;
}

function TaskCardComponent({ task, allTasks, onEdit, onDelete, onToggleComplete, onShare, onDuplicate, selectionMode, isSelected, onToggleSelect, taskRef, isHighlighted }: TaskCardProps) {
  // React Compiler handles optimization automatically
  const dueLabel = formatDueDate(task.dueDate);
  const taskIsOverdue = !task.completed && isOverdue(task.dueDate);
  const taskIsDueToday = !task.completed && isDueToday(task.dueDate);
  const completedSubtasks = task.subtasks.filter(st => st.completed).length;
  const totalSubtasks = task.subtasks.length;

  // Dependency calculations - keep for complex external function calls
  const blockingTasks = getUncompletedBlockingTasks(task, allTasks);
  const blockedTasks = getBlockedTasks(task.id, allTasks);
  const isBlocked = blockingTasks.length > 0;
  const isBlocking = blockedTasks.length > 0;

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
      ref={(node) => {
        setNodeRef(node);
        if (taskRef && node) {
          taskRef(node);
        }
      }}
      style={style}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition",
        task.completed ? "opacity-60" : "opacity-100",
        isDragging && "cursor-grabbing",
        taskIsOverdue ? "border-red-300 bg-red-50/50" : "border-card-border",
        selectionMode && isSelected && "ring-2 ring-accent ring-offset-2",
        isHighlighted && "animate-pulse-highlight ring-4 ring-accent ring-offset-2"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {selectionMode ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(task)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2"
              aria-label={`Select ${task.title}`}
            />
          ) : (
            <button
              type="button"
              className="cursor-grab touch-none shrink-0 rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-background-muted"
              aria-label="Drag to move task"
              {...attributes}
              {...listeners}
            >
              <GripVerticalIcon className="h-4 w-4 text-foreground-muted" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h3 className={cn(
              "text-sm font-semibold leading-snug text-foreground truncate",
              task.completed && "line-through"
            )}>
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

      {/* Dependency indicators */}
      {(isBlocked || isBlocking) && !task.completed ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {isBlocked ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-2 py-0.5 text-amber-700 dark:text-amber-300 font-medium"
              title={`Blocked by: ${blockingTasks.map(t => t.title).join(", ")}`}
            >
              <LockIcon className="h-3 w-3" />
              Blocked by {blockingTasks.length}
            </span>
          ) : null}
          {isBlocking ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-2 py-0.5 text-blue-700 dark:text-blue-300 font-medium"
              title={`Blocking: ${blockedTasks.map(t => t.title).join(", ")}`}
            >
              <LinkIcon className="h-3 w-3" />
              Blocking {blockedTasks.length}
            </span>
          ) : null}
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
          {onShare && (
            <button
              type="button"
              onClick={() => onShare(task)}
              className="rounded p-2 sm:px-1.5 sm:py-0.5 hover:bg-background-muted hover:text-foreground touch-manipulation"
              aria-label="Share task"
            >
              <Share2Icon className="h-4 w-4 sm:h-3 sm:w-3" />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(task)}
              className="rounded p-2 sm:px-1.5 sm:py-0.5 hover:bg-background-muted hover:text-foreground touch-manipulation"
              aria-label="Duplicate task"
            >
              <CopyIcon className="h-4 w-4 sm:h-3 sm:w-3" />
            </button>
          )}
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

// ============================================================================
// Memo Comparison Helpers
// Each helper handles one aspect of comparison, keeping functions under 30 lines
// ============================================================================

/** Get IDs of tasks related to this task via dependencies */
function getRelatedDependencyIds(task: TaskRecord, allTasks: TaskRecord[]): Set<string> {
  return new Set([
    ...task.dependencies,
    ...allTasks.filter(t => t.dependencies.includes(task.id)).map(t => t.id)
  ]);
}

/** Check if dependency-related tasks changed in ways that affect rendering */
function haveDependenciesChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prevIds = getRelatedDependencyIds(prevProps.task, prevProps.allTasks);
  const nextIds = getRelatedDependencyIds(nextProps.task, nextProps.allTasks);

  if (prevIds.size !== nextIds.size) return true;

  for (const depId of prevIds) {
    const prevTask = prevProps.allTasks.find(t => t.id === depId);
    const nextTask = nextProps.allTasks.find(t => t.id === depId);
    if (!prevTask || !nextTask) return true;
    if (prevTask.completed !== nextTask.completed || prevTask.title !== nextTask.title) return true;
  }
  return false;
}

/** Check if core task properties changed */
function haveTaskPropertiesChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prev = prevProps.task;
  const next = nextProps.task;
  return (
    prev.id !== next.id ||
    prev.title !== next.title ||
    prev.description !== next.description ||
    prev.completed !== next.completed ||
    prev.urgent !== next.urgent ||
    prev.important !== next.important ||
    prev.dueDate !== next.dueDate ||
    prev.recurrence !== next.recurrence ||
    prev.updatedAt !== next.updatedAt
  );
}

/** Check if arrays (tags, subtasks, dependencies) changed */
function haveArraysChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  const prev = prevProps.task;
  const next = nextProps.task;
  return (
    prev.tags.length !== next.tags.length ||
    prev.subtasks.length !== next.subtasks.length ||
    prev.dependencies.length !== next.dependencies.length ||
    JSON.stringify(prev.tags) !== JSON.stringify(next.tags) ||
    JSON.stringify(prev.subtasks) !== JSON.stringify(next.subtasks) ||
    JSON.stringify(prev.dependencies) !== JSON.stringify(next.dependencies)
  );
}

/** Check if UI state props changed */
function hasUIStateChanged(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  return (
    prevProps.selectionMode !== nextProps.selectionMode ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.allTasks.length !== nextProps.allTasks.length
  );
}

/** Main comparison function for React.memo - composed from helpers */
function areTaskCardPropsEqual(prevProps: TaskCardProps, nextProps: TaskCardProps): boolean {
  if (haveDependenciesChanged(prevProps, nextProps)) return false;
  if (haveTaskPropertiesChanged(prevProps, nextProps)) return false;
  if (haveArraysChanged(prevProps, nextProps)) return false;
  if (hasUIStateChanged(prevProps, nextProps)) return false;
  return true;
}

// Memoize the component to prevent unnecessary re-renders
export const TaskCard = memo(TaskCardComponent, areTaskCardPropsEqual);
