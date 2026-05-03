"use client";

import { LockIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskTimer } from "@/components/task-timer";
import type { TaskRecord } from "@/lib/types";

export interface TaskCardMetadataProps {
  task: TaskRecord;
  completedSubtasks: number;
  totalSubtasks: number;
  isBlocked: boolean;
  isBlocking: boolean;
  blockingTasks: TaskRecord[];
  blockedTasks: TaskRecord[];
  onStartTimer?: (taskId: string) => Promise<void>;
  onStopTimer?: (taskId: string) => Promise<void>;
}

export function TaskCardMetadata({
  task,
  completedSubtasks,
  totalSubtasks,
  isBlocked,
  isBlocking,
  blockingTasks,
  blockedTasks,
  onStartTimer,
  onStopTimer,
}: TaskCardMetadataProps) {
  return (
    <>
      {/* Tags — neutral chips, leading dot, no hashtag glyph (implied) */}
      {task.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-border-muted bg-background-muted px-2 py-0.5 text-xs font-medium text-foreground-muted"
            >
              <span className="h-[5px] w-[5px] rounded-full bg-current" aria-hidden />
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
              className="inline-flex items-center gap-1 rounded-full bg-status-blocked-muted border border-status-blocked/20 px-2 py-0.5 text-status-blocked font-medium"
              title={`Blocked by: ${blockingTasks.map(t => t.title).join(", ")}`}
            >
              <LockIcon className="h-3 w-3" />
              Blocked by {blockingTasks.length}
            </span>
          ) : null}
          {isBlocking ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-status-blocking-muted border border-status-blocking/20 px-2 py-0.5 text-status-blocking font-medium"
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
    </>
  );
}
