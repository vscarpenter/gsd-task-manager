import type { TaskRecord } from "@/lib/types";

/**
 * Props interface for TaskCard component
 * This is the canonical definition, imported by components/task-card.tsx
 */
export interface TaskCardProps {
  task: TaskRecord;
  allTasks: TaskRecord[];
  onEdit: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => Promise<void> | void;
  onToggleComplete: (task: TaskRecord, completed: boolean) => Promise<void> | void;
  /** Opens the task's read-only detail surface without changing persistence. */
  onInspect?: (task: TaskRecord) => void;
  onShare?: (task: TaskRecord) => void;
  onDuplicate?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
  onStartTimer?: (taskId: string) => Promise<void>;
  onStopTimer?: (taskId: string) => Promise<void>;
  taskRef?: (el: HTMLElement | null) => void;
  isHighlighted?: boolean;
}
