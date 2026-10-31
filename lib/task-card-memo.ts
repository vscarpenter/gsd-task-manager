import type { QuadrantId, TaskRecord } from "@/lib/types";

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
  onSave?: (task: TaskRecord) => Promise<void> | void;
  /** Moves the task to a quadrant from the card menu; the owner offers Undo. */
  onMoveTo?: (task: TaskRecord, quadrant: QuadrantId) => Promise<void> | void;
  /** Sets the urgent flag on an escalating task; the owner offers Undo. */
  onMarkUrgent?: (task: TaskRecord) => Promise<void> | void;
  onSnooze?: (taskId: string, minutes: number) => Promise<void>;
  onClearSnooze?: (taskId: string) => Promise<void>;
  onStartTimer?: (taskId: string) => Promise<void>;
  onStopTimer?: (taskId: string) => Promise<void>;
  taskRef?: (el: HTMLElement | null) => void;
  isHighlighted?: boolean;
}
