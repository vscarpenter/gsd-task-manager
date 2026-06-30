"use client";

import { useState, useEffect } from "react";
import { PlayIcon, PauseIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskRecord } from "@/lib/types";
import {
  hasRunningTimer,
  getRunningEntry,
  formatTimeSpent,
} from "@/lib/tasks";
import { TIME_TRACKING } from "@/lib/constants";

interface TaskTimerProps {
  task: TaskRecord;
  onStartTimer: (taskId: string) => Promise<void>;
  onStopTimer: (taskId: string) => Promise<void>;
  compact?: boolean;
  className?: string;
}

/**
 * Calculate elapsed time in minutes from a running entry
 */
function calculateElapsedMinutes(startedAt: string): number {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  return Math.floor((now - start) / TIME_TRACKING.MS_PER_MINUTE);
}

/**
 * Format elapsed seconds to mm:ss or hh:mm:ss
 */
function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / TIME_TRACKING.SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % TIME_TRACKING.SECONDS_PER_HOUR) / TIME_TRACKING.SECONDS_PER_MINUTE);
  const seconds = totalSeconds % TIME_TRACKING.SECONDS_PER_MINUTE;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function TaskTimer({
  task,
  onStartTimer,
  onStopTimer,
  compact = false,
  className,
}: TaskTimerProps) {
  const isRunning = hasRunningTimer(task);
  const runningEntry = getRunningEntry(task);
  const [isLoading, setIsLoading] = useState(false);
  // The current wall-clock time, kept in state because Date.now() is impure and
  // cannot be read during render. The interval below advances it once per second
  // while a timer runs — a clock subscription, not prop->state sync.
  const [now, setNow] = useState(() => Date.now());

  const startMs =
    isRunning && runningEntry
      ? new Date(runningEntry.startedAt).getTime()
      : null;
  // Derive elapsed seconds during render from the clock state. Zero when no
  // timer is running, so it resets automatically when the running prop clears.
  const elapsedSeconds =
    startMs !== null ? Math.max(0, Math.floor((now - startMs) / 1000)) : 0;

  // Advance the clock once per second while a timer is running so the derived
  // elapsed time re-renders. This subscribes to an external clock; it does not
  // synchronize prop-derived values into state.
  useEffect(() => {
    if (startMs === null) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [startMs]);

  const handleToggle = async () => {
    setIsLoading(true);
    // No `finally`: the React Compiler can't yet optimize a component with a
    // try/finally, so the loading reset is duplicated across both paths.
    try {
      if (isRunning) {
        await onStopTimer(task.id);
      } else {
        await onStartTimer(task.id);
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  // Only calculate elapsed minutes when timer is actually running (fixes Issue #2: race condition)
  const currentElapsedMinutes = runningEntry ? calculateElapsedMinutes(runningEntry.startedAt) : 0;
  const totalTimeSpent = (task.timeSpent || 0) + currentElapsedMinutes;
  const estimatedMinutes = task.estimatedMinutes;
  const isOverEstimate = estimatedMinutes !== undefined && estimatedMinutes > 0 && totalTimeSpent > estimatedMinutes;

  // Dynamic ARIA label including elapsed time for screen readers (fixes Issue #7)
  const ariaLabel = (() => {
    if (isRunning) {
      return `Stop timer. Elapsed: ${formatElapsedTime(elapsedSeconds)}. Total tracked: ${formatTimeSpent(totalTimeSpent)}`;
    }
    const tracked = task.timeSpent ? formatTimeSpent(task.timeSpent) : "no time tracked";
    return `Start timer. ${tracked}`;
  })();

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition touch-manipulation",
          isRunning
            ? "bg-status-success-muted text-status-success animate-pulse"
            : "bg-background-muted text-foreground-muted hover:bg-background hover:text-foreground",
          isLoading && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-label={ariaLabel}
      >
        {isRunning ? (
          <>
            <PauseIcon className="h-3 w-3" />
            <span className="font-mono">{formatElapsedTime(elapsedSeconds)}</span>
          </>
        ) : (
          <>
            <PlayIcon className="h-3 w-3" />
            {task.timeSpent ? (
              <span>{formatTimeSpent(task.timeSpent)}</span>
            ) : (
              <span>Track</span>
            )}
          </>
        )}
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition touch-manipulation",
          isRunning
            ? "bg-status-success text-card hover:bg-status-success/90"
            : "bg-background-muted text-foreground-muted hover:bg-accent hover:text-card",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
        aria-label={ariaLabel}
      >
        {isRunning ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4" />
        )}
      </button>

      <div className="flex flex-col">
        {isRunning && (
          <span className="font-mono text-sm font-medium text-status-success">
            {formatElapsedTime(elapsedSeconds)}
          </span>
        )}
        <div className="flex items-center gap-1 text-xs text-foreground-muted">
          <ClockIcon className="h-3 w-3" />
          <span className={cn(isOverEstimate && "text-status-blocked")}>
            {formatTimeSpent(totalTimeSpent)}
          </span>
          {estimatedMinutes && (
            <>
              <span>/</span>
              <span>{formatTimeSpent(estimatedMinutes)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
