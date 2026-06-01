"use client";

import { PencilIcon, Trash2Icon, RepeatIcon, AlertCircleIcon, Share2Icon, CopyIcon, MoreHorizontalIcon, ClockIcon } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { TIME_MS } from "@/lib/constants";
import { SnoozeDropdown } from "@/components/snooze-dropdown";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TaskRecord } from "@/lib/types";

/** True when a future due date is within 24h. Used to color-shift the clock glyph. */
function isWithinDay(iso: string): boolean {
  const due = new Date(iso).getTime();
  const now = Date.now();
  const diff = due - now;
  return diff > 0 && diff < TIME_MS.DAY;
}

export interface TaskCardActionsProps {
  task: TaskRecord;
  taskIsOverdue: boolean;
  taskIsDueToday: boolean;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
}

export function TaskCardActions({
  task,
  taskIsOverdue,
  taskIsDueToday,
  onEdit,
  onDelete,
  onShare,
  onDuplicate,
  onSnooze,
}: TaskCardActionsProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-foreground-muted">
      <div className="flex items-center gap-2">
        {taskIsDueToday && !taskIsOverdue ? (
          <span className="flex items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-warning-dark font-medium">
            <AlertCircleIcon className="h-3 w-3" />
            Due today
          </span>
        ) : task.dueDate && !taskIsOverdue ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 truncate",
              isWithinDay(task.dueDate) && "text-status-overdue"
            )}
          >
            <ClockIcon className="h-3 w-3 shrink-0" aria-hidden />
            {formatRelative(task.dueDate)}
          </span>
        ) : null}
        {task.recurrence !== "none" ? (
          <span
            className="flex items-center gap-1 text-accent"
            title={`Recurs ${task.recurrence}`}
            aria-label={`Recurs ${task.recurrence}`}
          >
            <RepeatIcon className="h-3 w-3" />
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {/* Desktop: all buttons on hover */}
        <DesktopActions task={task} onEdit={onEdit} onDelete={onDelete} onShare={onShare} onDuplicate={onDuplicate} onSnooze={onSnooze} />

        {/* Mobile: edit + overflow menu */}
        <MobileActions task={task} onEdit={onEdit} onDelete={onDelete} onShare={onShare} onDuplicate={onDuplicate} />
      </div>
    </div>
  );
}

interface DesktopActionsProps {
  task: TaskRecord;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
}

function DesktopActions({ task, onEdit, onDelete, onShare, onDuplicate, onSnooze }: DesktopActionsProps) {
  return (
    <div className="task-card-desktop-actions hidden sm:flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
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
            data-testid="edit-task"
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
            data-testid="delete-task"
            type="button"
            onClick={() => onDelete(task)}
            className="rounded px-1.5 py-0.5 flex items-center justify-center text-rust hover:bg-rust-tint hover:text-rust-d transition-colors"
            aria-label="Delete task"
          >
            <Trash2Icon className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Delete task</TooltipContent>
      </Tooltip>
    </div>
  );
}

interface MobileActionsProps {
  task: TaskRecord;
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
}

function MobileActions({ task, onEdit, onDelete, onShare, onDuplicate }: MobileActionsProps) {
  return (
    <div className="task-card-mobile-actions flex sm:hidden items-center gap-0.5">
      <button
        data-testid="edit-task-mobile"
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
            data-testid="task-card-menu"
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
          <DropdownMenuItem data-testid="delete-task" onClick={() => onDelete(task)} className="text-rust focus:text-rust">
            <Trash2Icon className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
