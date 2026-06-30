export type QuadrantId = "urgent-important" | "not-urgent-important" | "urgent-not-important" | "not-urgent-not-important";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

/** A time tracking entry for when user actively works on a task */
export interface TimeEntry {
  id: string;
  startedAt: string; // ISO 8601 timestamp
  endedAt?: string;  // ISO 8601 timestamp, null if currently running
  notes?: string;    // Optional notes about what was done
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
  // Archive field
  archivedAt?: string; // Timestamp when task was archived
  // Time tracking fields
  estimatedMinutes?: number; // Estimated time to complete task
  timeSpent?: number; // Total time spent in minutes (calculated from timeEntries)
  timeEntries?: TimeEntry[]; // Array of time tracking sessions
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
  estimatedMinutes?: number; // Estimated time to complete task
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
  status: "success" | "error" | "conflict" | "partial";
  pushedCount: number; // Number of local changes pushed
  pulledCount: number; // Number of remote changes pulled
  conflictsResolved: number; // Number of conflicts automatically resolved
  /** Items that failed to push in this sync cycle. Only set for status='partial'. */
  failedCount?: number;
  errorMessage?: string; // Error message if status is "error"
  duration?: number; // Sync duration in milliseconds
  deviceId: string; // Device that performed the sync
  triggeredBy: "user" | "auto"; // Whether sync was manual or automatic
}

export interface AppPreferences {
  id: "preferences";
  pinnedSmartViewIds: string[]; // IDs of smart views pinned to header
  maxPinnedViews: number; // Maximum number of views that can be pinned (default: 5)
  smartViewsEnabled: boolean; // Exposes Smart Views in the matrix and command palette
}
