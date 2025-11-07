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
  completedAt?: string; // Timestamp when task was marked complete
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
  // Archive field
  archivedAt?: string; // Timestamp when task was archived
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

export interface ArchiveSettings {
  id: "settings";
  enabled: boolean;
  archiveAfterDays: 30 | 60 | 90; // Days after completion before archiving
}
export interface SyncHistoryRecord {
  id: string;
  timestamp: string; // ISO 8601 timestamp
  status: "success" | "error" | "conflict";
  pushedCount: number; // Number of local changes pushed
  pulledCount: number; // Number of remote changes pulled
  conflictsResolved: number; // Number of conflicts automatically resolved
  errorMessage?: string; // Error message if status is "error"
  duration?: number; // Sync duration in milliseconds
  deviceId: string; // Device that performed the sync
  triggeredBy: "user" | "auto"; // Whether sync was manual or automatic
}
