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
}
