"use client";

import { memo } from "react";
import { CheckCircle2Icon, GripVerticalIcon, PencilIcon, Trash2Icon, RepeatIcon, AlertCircleIcon, TagIcon, LockIcon, LinkIcon, Share2Icon, CopyIcon, MoreHorizontalIcon } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatRelative, cn, isOverdue, isDueToday } from "@/lib/utils";
import { getUncompletedBlockingTasks, getBlockedTasks } from "@/lib/dependencies";
import { SnoozeDropdown } from "@/components/snooze-dropdown";
import { TaskTimer } from "@/components/task-timer";
import { areTaskCardPropsEqual, type TaskCardProps } from "@/lib/task-card-memo";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function TaskCardComponent({ task, allTasks, onEdit, onDelete, onToggleComplete, onShare, onDuplicate, onSnooze, onStartTimer, onStopTimer, selectionMode, isSelected, onToggleSelect, taskRef, isHighlighted }: TaskCardProps) {
  // React Compiler handles optimization automatically
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
    opacity: isDragging ? 0.5 : undefined,
    boxShadow: isDragging ? 'var(--shadow-card-hover)' : 'var(--shadow-card)'
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
        "group flex flex-col gap-2 rounded-xl border bg-card p-3 transition-all duration-200 animate-slide-in-card",
        task.completed ? "opacity-60" : "opacity-100 hover:-translate-y-0.5",
        task.completed && "animate-complete-flash",
        isDragging && "cursor-grabbing",
        taskIsOverdue ? "border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30" : "border-card-border",
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
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 cursor-pointer"
              aria-label={`Select ${task.title}`}
            />
          ) : (
            <button
              type="button"
              className="cursor-grab touch-none shrink-0 rounded p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-background-muted"
              aria-label="Drag to move task"
              {...attributes}
              {...listeners}
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
                "button-reset flex shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase transition-all duration-200",
                "h-7 w-7 md:h-7 md:w-7",
                "sm:h-9 sm:w-9",
                task.completed
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400 scale-100"
                  : "border-border text-foreground-muted hover:border-accent hover:text-accent hover:bg-accent/5 hover:scale-110"
              )}
              aria-pressed={task.completed}
              aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
            >
              <CheckCircle2Icon className={cn("h-4 w-4 sm:h-4 sm:w-4", !task.completed && "opacity-30")} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{task.completed ? "Mark as incomplete" : "Mark as complete"}</TooltipContent>
        </Tooltip>
      </div>

      {/* Tags */}
      {task.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
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
          <div className="flex-1 h-1.5 rounded-full bg-background-muted/80 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                completedSubtasks === totalSubtasks ? "bg-emerald-500" : "bg-accent"
              )}
              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
            />
          </div>
          <span className={cn(
            "shrink-0 tabular-nums",
            completedSubtasks === totalSubtasks ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-foreground-muted"
          )}>
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

      {/* Time tracking */}
      {onStartTimer && onStopTimer && !task.completed && (task.estimatedMinutes || task.timeSpent || task.timeEntries?.some(e => !e.endedAt)) ? (
        <TaskTimer
          task={task}
          onStartTimer={onStartTimer}
          onStopTimer={onStopTimer}
          compact
        />
      ) : null}

      <div className="flex items-center justify-between gap-2 text-xs text-foreground-muted">
        <div className="flex items-center gap-2">
          {taskIsOverdue ? (
            <span className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-red-600 dark:text-red-400 font-medium">
              <AlertCircleIcon className="h-3 w-3" />
              Overdue
            </span>
          ) : taskIsDueToday ? (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircleIcon className="h-3 w-3" />
              Due today
            </span>
          ) : task.dueDate ? (
            <span className="truncate">{formatRelative(task.dueDate)}</span>
          ) : null}
          {task.recurrence !== "none" ? (
            <span className="flex items-center gap-1 text-accent" title={`Recurs ${task.recurrence}`}>
              <RepeatIcon className="h-3 w-3" />
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {/* Desktop: all buttons on hover */}
          <div className="hidden sm:flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            {onShare && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onShare(task)}
                    className="rounded px-1.5 py-0.5 flex items-center justify-center hover:bg-background-muted hover:text-foreground transition-colors"
                    aria-label="Share task"
                  >
                    <Share2Icon className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Share task</TooltipContent>
              </Tooltip>
            )}
            {onDuplicate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onDuplicate(task)}
                    className="rounded px-1.5 py-0.5 flex items-center justify-center hover:bg-background-muted hover:text-foreground transition-colors"
                    aria-label="Duplicate task"
                  >
                    <CopyIcon className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Duplicate task</TooltipContent>
              </Tooltip>
            )}
            {onSnooze && task.dueDate && !task.completed && (
              <SnoozeDropdown task={task} onSnooze={onSnooze} />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="rounded px-1.5 py-0.5 flex items-center justify-center hover:bg-background-muted hover:text-foreground transition-colors"
                  aria-label="Edit task"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit task</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onDelete(task)}
                  className="rounded px-1.5 py-0.5 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  aria-label="Delete task"
                >
                  <Trash2Icon className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete task</TooltipContent>
            </Tooltip>
          </div>

          {/* Mobile: edit + overflow menu */}
          <div className="flex sm:hidden items-center gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-background-muted hover:text-foreground touch-manipulation transition-colors"
              aria-label="Edit task"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-background-muted hover:text-foreground touch-manipulation transition-colors"
                  aria-label="More actions"
                >
                  <MoreHorizontalIcon className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onShare && (
                  <DropdownMenuItem onClick={() => onShare(task)}>
                    <Share2Icon className="mr-2 h-4 w-4" />
                    Share
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(task)}>
                    <CopyIcon className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDelete(task)} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </article>
  );
}

// Memoize the component to prevent unnecessary re-renders
// Comparison function imported from @/lib/task-card-memo
export const TaskCard = memo(TaskCardComponent, areTaskCardPropsEqual);
