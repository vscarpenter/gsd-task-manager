"use client";

import { useMemo } from "react";
import { AlertCircleIcon, CalendarIcon, ClockIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { quadrants } from "@/lib/quadrants";
import { isOverdue, isDueToday } from "@/lib/utils";
import { TIME_MS } from "@/lib/constants";

interface UpcomingDeadlinesProps {
  tasks: TaskRecord[];
  onTaskClick?: (task: TaskRecord) => void;
}

const QUADRANT_BY_ID = new Map(quadrants.map((quadrant) => [quadrant.id, quadrant]));

/**
 * Widget showing tasks due soon, grouped by urgency.
 * Uses theme-aware colors for proper dark mode support.
 */
export function UpcomingDeadlines({ tasks, onTaskClick }: UpcomingDeadlinesProps) {
  const { overdueTasks, dueTodayTasks, dueThisWeekTasks, hasDeadlines } = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const overdue: TaskRecord[] = [];
    const today: TaskRecord[] = [];
    const thisWeek: TaskRecord[] = [];

    for (const task of tasks) {
      if (task.completed || !task.dueDate) continue;
      if (isOverdue(task.dueDate)) {
        overdue.push(task);
      } else if (isDueToday(task.dueDate)) {
        today.push(task);
      } else {
        const dueDate = new Date(task.dueDate);
        if (dueDate > now && dueDate <= weekFromNow) {
          thisWeek.push(task);
        }
      }
    }

    return {
      overdueTasks: overdue,
      dueTodayTasks: today,
      dueThisWeekTasks: thisWeek,
      hasDeadlines: overdue.length > 0 || today.length > 0 || thisWeek.length > 0,
    };
  }, [tasks]);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 rd-serif text-title text-foreground">
        Upcoming Deadlines
      </h3>

      {!hasDeadlines ? (
        <div className="flex h-[240px] items-center justify-center">
          <p className="text-sm text-foreground-muted">
            No upcoming deadlines. You&apos;re all caught up!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {overdueTasks.length > 0 && (
            <DeadlineSection
              title="Overdue"
              icon={<AlertCircleIcon className="h-4 w-4 text-status-overdue" />}
              tasks={overdueTasks}
              onTaskClick={onTaskClick}
              color="overdue"
            />
          )}

          {dueTodayTasks.length > 0 && (
            <DeadlineSection
              title="Due Today"
              icon={<CalendarIcon className="h-4 w-4 text-warning" />}
              tasks={dueTodayTasks}
              onTaskClick={onTaskClick}
              color="warning"
            />
          )}

          {dueThisWeekTasks.length > 0 && (
            <DeadlineSection
              title="Due This Week"
              icon={<ClockIcon className="h-4 w-4 text-sky" />}
              tasks={dueThisWeekTasks}
              onTaskClick={onTaskClick}
              color="info"
            />
          )}
        </div>
      )}
    </div>
  );
}

interface DeadlineSectionProps {
  title: string;
  icon: React.ReactNode;
  tasks: TaskRecord[];
  onTaskClick?: (task: TaskRecord) => void;
  color: "overdue" | "warning" | "info";
}

function DeadlineSection({
  title,
  icon,
  tasks,
  onTaskClick,
  color,
}: DeadlineSectionProps) {
  const borderColor = {
    overdue: "border-l-status-overdue",
    warning: "border-l-warning",
    info: "border-l-sky",
  }[color];

  const bgColor = {
    overdue: "bg-status-overdue-muted",
    warning: "bg-warning-tint",
    info: "bg-status-blocking-muted",
  }[color];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-foreground">
          {title} ({tasks.length})
        </h4>
      </div>
      <ul className="space-y-1.5">
        {tasks.slice(0, 5).map((task) => {
          const quadrant = QUADRANT_BY_ID.get(task.quadrant);
          return (
            <li key={task.id}>
              <button
                onClick={() => onTaskClick?.(task)}
                className={`w-full cursor-pointer rounded-lg border-l-4 ${borderColor} ${bgColor} p-3 text-left transition-all hover:shadow-sm`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {formatDueDate(task.dueDate)}
                      </p>
                    )}
                  </div>
                  {quadrant && (
                    <span className="shrink-0 rounded-full bg-background-muted px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
                      {quadrant.title}
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
        {tasks.length > 5 && (
          <li className="pl-3 text-xs text-foreground-muted">
            +{tasks.length - 5} more
          </li>
        )}
      </ul>
    </div>
  );
}

function formatDueDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / TIME_MS.DAY);

  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return `In ${diffDays} days`;
}
