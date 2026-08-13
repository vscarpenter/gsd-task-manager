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
}
