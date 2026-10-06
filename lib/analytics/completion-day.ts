import { format } from "date-fns";
import type { TaskRecord } from "@/lib/types";

/**
 * When a task was completed. Imports and pulls can carry a completed task with
 * no completedAt, so those fall back to updatedAt, as nudge eligibility does.
 * The pull doesn't validate completed_at, so an unparseable one falls back too;
 * otherwise one bad record would throw in localDayKey and take down the dashboard.
 * Keep this rule in step with the MCP copy in packages/mcp-server/src/analytics/date-utils.ts.
 */
export function completionTime(task: Pick<TaskRecord, "completedAt" | "updatedAt">): Date {
  const completed = task.completedAt ? new Date(task.completedAt) : null;
  return completed && !Number.isNaN(completed.getTime()) ? completed : new Date(task.updatedAt);
}

/** The local calendar day a moment falls on, as yyyy-MM-dd. */
export function localDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
