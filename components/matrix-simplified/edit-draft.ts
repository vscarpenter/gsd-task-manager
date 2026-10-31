import type { RecurrenceType, Subtask } from "@/lib/types";

export interface EditDraft {
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  tags: string[];
  dependencies: string[];
  recurrence: RecurrenceType;
  subtasks: Subtask[];
  estimatedMinutes?: number;
  /** Minutes before the due date to remind. Undefined means "use the global default". */
  notifyBefore?: number;
  notificationEnabled?: boolean;
  /** When the task wakes up again. Undefined means not snoozed; saved on its own, not through the draft schema. */
  snoozedUntil?: string;
}
