"use client";

import { LockIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskTimer } from "@/components/task-timer";
import type { TaskRecord } from "@/lib/types";

export interface TaskCardMetadataProps {
  task: TaskRecord;
  /** CSS var for the task's quadrant pigment, e.g. "var(--q1)". */
  accentVar: string;
  /** CSS var for the quadrant wash, e.g. "var(--q1-wash)". */
  washVar: string;
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
  accentVar,
  washVar,
  completedSubtasks,
  totalSubtasks,
  isBlocked,
  isBlocking,
  blockingTasks,
  blockedTasks,
  onStartTimer,
  onStopTimer,
}: TaskCardMetadataProps) {
  const subtasksDone = totalSubtasks > 0 && completedSubtasks === totalSubtasks;
  return (
    <>
      {/* Tags — quadrant-wash chips with quadrant-accent text (reference §06) */}
      {task.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              data-testid="task-tag"
              style={{ backgroundColor: washVar, color: accentVar }}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Subtasks progress — quadrant accent fill, success green at 100% */}
      {totalSubtasks > 0 ? (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex-1 h-1.5 rounded-full bg-background-muted/80 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                subtasksDone && "bg-status-success"
              )}
              style={{
                width: `${(completedSubtasks / totalSubtasks) * 100}%`,
                backgroundColor: subtasksDone ? undefined : accentVar,
              }}
            />
          </div>
          <span className={cn(
            "shrink-0 tabular-nums",
            completedSubtasks === totalSubtasks ? "text-foreground font-medium" : "text-foreground-muted"
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
