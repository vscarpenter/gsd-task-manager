"use client";

import { PencilIcon, Trash2Icon, RepeatIcon, AlertCircleIcon, Share2Icon, CopyIcon, MoreHorizontalIcon } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import { SnoozeDropdown } from "@/components/snooze-dropdown";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TaskRecord } from "@/lib/types";

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
  );
}
