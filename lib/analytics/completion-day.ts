import { format } from "date-fns";
import type { TaskRecord } from "@/lib/types";

/**
 * When a task was completed. Imports and pulls can carry a completed task with
 * no completedAt, so those fall back to updatedAt, as nudge eligibility does.
 * Keep this rule in step with the MCP copy in packages/mcp-server/src/analytics/date-utils.ts.
 */
export function completionTime(task: Pick<TaskRecord, "completedAt" | "updatedAt">): Date {
  return new Date(task.completedAt || task.updatedAt);
}

/** The local calendar day a moment falls on, as yyyy-MM-dd. */
export function localDayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
