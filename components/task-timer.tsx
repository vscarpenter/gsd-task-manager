"use client";

import { useState, useEffect, useMemo } from "react";
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Update elapsed time every second when timer is running
  useEffect(() => {
    if (!isRunning || !runningEntry) {
      setElapsedSeconds(0);
      return;
    }

    // Initialize with current elapsed time
    const start = new Date(runningEntry.startedAt).getTime();
    setElapsedSeconds(Math.floor((Date.now() - start) / 1000));

    // Update every second
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, runningEntry]);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      if (isRunning) {
        await onStopTimer(task.id);
      } else {
        await onStartTimer(task.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Only calculate elapsed minutes when timer is actually running (fixes Issue #2: race condition)
  const currentElapsedMinutes = runningEntry ? calculateElapsedMinutes(runningEntry.startedAt) : 0;
  const totalTimeSpent = (task.timeSpent || 0) + currentElapsedMinutes;
  const estimatedMinutes = task.estimatedMinutes;
  const isOverEstimate = estimatedMinutes !== undefined && estimatedMinutes > 0 && totalTimeSpent > estimatedMinutes;

  // Dynamic ARIA label including elapsed time for screen readers (fixes Issue #7)
  const ariaLabel = useMemo(() => {
    if (isRunning) {
      return `Stop timer. Elapsed: ${formatElapsedTime(elapsedSeconds)}. Total tracked: ${formatTimeSpent(totalTimeSpent)}`;
    }
    const tracked = task.timeSpent ? formatTimeSpent(task.timeSpent) : "no time tracked";
    return `Start timer. ${tracked}`;
  }, [isRunning, elapsedSeconds, totalTimeSpent, task.timeSpent]);

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition touch-manipulation",
          isRunning
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 animate-pulse"
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
            ? "bg-green-500 text-white hover:bg-green-600"
            : "bg-background-muted text-foreground-muted hover:bg-accent hover:text-white",
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
          <span className="font-mono text-sm font-medium text-green-600 dark:text-green-400">
            {formatElapsedTime(elapsedSeconds)}
          </span>
        )}
        <div className="flex items-center gap-1 text-xs text-foreground-muted">
          <ClockIcon className="h-3 w-3" />
          <span className={cn(isOverEstimate && "text-amber-600 dark:text-amber-400")}>
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
