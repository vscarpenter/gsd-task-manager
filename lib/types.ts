export type QuadrantId = "urgent-important" | "not-urgent-important" | "urgent-not-important" | "not-urgent-not-important";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  quadrant: QuadrantId;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  // New fields for enhancements
  recurrence: RecurrenceType;
  tags: string[];
  subtasks: Subtask[];
  parentTaskId?: string; // For recurring task instances
  dependencies: string[]; // IDs of tasks that must be completed first
  // Notification fields
  notifyBefore?: number; // minutes before due date
  notificationEnabled: boolean;
  notificationSent: boolean;
  lastNotificationAt?: string;
  snoozedUntil?: string;
  // Sync fields
  vectorClock?: { [deviceId: string]: number }; // For distributed sync conflict detection
}

export interface TaskDraft {
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
  dueDate?: string;
  recurrence?: RecurrenceType;
  tags?: string[];
  subtasks?: Subtask[];
  dependencies?: string[];
  notifyBefore?: number;
  notificationEnabled?: boolean;
}

export interface ImportPayload {
  tasks: TaskRecord[];
  exportedAt: string;
  version: string;
}

export interface NotificationSettings {
  id: "settings";
  enabled: boolean;
  defaultReminder: number; // minutes before due date
  soundEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  permissionAsked: boolean;
  updatedAt: string;
}
