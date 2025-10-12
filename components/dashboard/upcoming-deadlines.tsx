"use client";

import { AlertCircleIcon, CalendarIcon, ClockIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { quadrants } from "@/lib/quadrants";
import { isOverdue, isDueToday } from "@/lib/utils";

interface UpcomingDeadlinesProps {
  tasks: TaskRecord[];
  onTaskClick?: (task: TaskRecord) => void;
}

/**
 * Widget showing tasks due soon, grouped by urgency
 */
export function UpcomingDeadlines({ tasks, onTaskClick }: UpcomingDeadlinesProps) {
  const now = new Date();

  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && isOverdue(t.dueDate));
  const dueTodayTasks = tasks.filter(t => !t.completed && t.dueDate && isDueToday(t.dueDate));
  const dueThisWeekTasks = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    const dueDate = new Date(t.dueDate);
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate > now && dueDate <= weekFromNow && !isDueToday(t.dueDate);
  });

  const hasDeadlines = overdueTasks.length > 0 || dueTodayTasks.length > 0 || dueThisWeekTasks.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-foreground">Upcoming Deadlines</h3>

      {!hasDeadlines ? (
        <p className="text-sm text-foreground-muted">No upcoming deadlines. You&apos;re all caught up! 🎉</p>
      ) : (
        <div className="space-y-4">
          {overdueTasks.length > 0 && (
            <DeadlineSection
              title="Overdue"
              icon={<AlertCircleIcon className="h-4 w-4 text-red-600" />}
              tasks={overdueTasks}
              onTaskClick={onTaskClick}
              color="red"
            />
          )}

          {dueTodayTasks.length > 0 && (
            <DeadlineSection
              title="Due Today"
              icon={<CalendarIcon className="h-4 w-4 text-amber-600" />}
              tasks={dueTodayTasks}
              onTaskClick={onTaskClick}
              color="amber"
            />
          )}

          {dueThisWeekTasks.length > 0 && (
            <DeadlineSection
              title="Due This Week"
              icon={<ClockIcon className="h-4 w-4 text-blue-600" />}
              tasks={dueThisWeekTasks}
              onTaskClick={onTaskClick}
              color="blue"
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
  color: "red" | "amber" | "blue";
}

function DeadlineSection({ title, icon, tasks, onTaskClick, color }: DeadlineSectionProps) {
  const borderColor = {
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    blue: "border-l-blue-500"
  }[color];

  const bgColor = {
    red: "bg-red-50",
    amber: "bg-amber-50",
    blue: "bg-blue-50"
  }[color];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-foreground">
          {title} ({tasks.length})
        </h4>
      </div>
      <ul className="space-y-2">
        {tasks.slice(0, 5).map(task => {
          const quadrant = quadrants.find(q => q.id === task.quadrant);
          return (
            <li key={task.id}>
              <button
                onClick={() => onTaskClick?.(task)}
                className={`w-full rounded-lg border-l-4 ${borderColor} ${bgColor} p-3 text-left transition-all hover:shadow-sm`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    {task.dueDate && (
                      <p className="mt-1 text-xs text-foreground-muted">
                        {formatDueDate(task.dueDate)}
                      </p>
                    )}
                  </div>
                  {quadrant && (
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-foreground-muted">
                      {quadrant.title}
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
        {tasks.length > 5 && (
          <li className="text-xs text-foreground-muted">
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
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return `In ${diffDays} days`;
}
