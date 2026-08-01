"use client";

import { LockIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskTimer } from "@/components/task-timer";
import type { TaskRecord } from "@/lib/types";

export interface TaskCardMetadataProps {
  task: TaskRecord;
  /** CSS var for the task's quadrant pigment, e.g. "var(--q1)". */
  accentVar: string;
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
      {/* Tags read neutral. Tinting them with the quadrant pigment restated a
          fact the pane, header, and card spine already carry three times over,
          and it mis-signalled: it implied the *tag* meant something about
          urgency when "infra" and "home" are orthogonal to the matrix. Color
          on this surface means quadrant, and only quadrant. */}
      {task.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              data-testid="task-tag"
              className="inline-flex items-center rounded-full bg-background-muted px-[9px] py-0.5 text-[11px] font-medium text-foreground-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Subtasks progress — quadrant accent fill, deepening to the accent at 100% */}
      {totalSubtasks > 0 ? (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex-1 h-[5px] rounded-full bg-background-muted overflow-hidden">
            {/* Fill scales on the compositor rather than animating `width`:
                a width transition relayouts every frame, and listing it
                explicitly would only trade one detector finding for another.
                300ms keeps it inside the 100-400ms UI transition band. */}
            <div
              data-testid="subtask-progress-fill"
              className={cn(
                "h-full w-full origin-left rounded-full transition-transform duration-300",
                subtasksDone && "bg-status-success"
              )}
              style={{
                transform: `scaleX(${completedSubtasks / totalSubtasks})`,
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
          {/* Tint-only chips: the border is gone (the tint alone separates them
              from the card) and the text takes the *-ink tone, because the base
              pigment reads at ~3:1 on its own tint — under the AA floor. */}
          {isBlocked ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-status-blocked-muted px-[9px] py-0.5 text-status-blocked-ink font-semibold"
              title={`Blocked by: ${blockingTasks.map(t => t.title).join(", ")}`}
            >
              <LockIcon className="h-3 w-3" />
              Blocked by {blockingTasks.length}
            </span>
          ) : null}
          {isBlocking ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-status-blocking-muted px-[9px] py-0.5 text-status-blocking-ink font-semibold"
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
