import Dexie, { Table } from "dexie";
import type { TaskRecord, NotificationSettings, ArchiveSettings, SyncHistoryRecord } from "@/lib/types";
import type { SmartView } from "@/lib/filters";
import type { SyncQueueItem, SyncConfig, DeviceInfo, EncryptionConfig } from "@/lib/sync/types";
import { ENV_CONFIG } from "@/lib/env-config";

class GsdDatabase extends Dexie {
  tasks!: Table<TaskRecord, string>;
  archivedTasks!: Table<TaskRecord, string>;
  smartViews!: Table<SmartView, string>;
  notificationSettings!: Table<NotificationSettings, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMetadata!: Table<SyncConfig | DeviceInfo | EncryptionConfig, string>;
  deviceInfo!: Table<DeviceInfo, string>;
  archiveSettings!: Table<ArchiveSettings, string>;
  syncHistory!: Table<SyncHistoryRecord, string>;

  constructor() {
    super("GsdTaskManager");

    // Version 1: Original schema
    this.version(1).stores({
      tasks: "id, quadrant, completed, dueDate"
    });

    // Version 2: Add new fields for enhancements (recurrence, tags, subtasks)
    // We keep the same indexes but add migration to populate defaults
    this.version(2)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags"
      })
      .upgrade((trans) => {
        // Migrate existing tasks to have new fields with defaults
        return trans.table("tasks").toCollection().modify((task: TaskRecord) => {
          if (task.recurrence === undefined) {
            task.recurrence = "none";
          }
          if (task.tags === undefined) {
            task.tags = [];
          }
          if (task.subtasks === undefined) {
            task.subtasks = [];
          }
        });
      });

    // Version 3: Add indexes for better query performance and fix test issues
    // Add createdAt and updatedAt indexes for sorting and filtering
    this.version(3).stores({
      tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]"
    });

    // Version 4: Add Smart Views table for saved filters
    this.version(4).stores({
      tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed]",
      smartViews: "id, name, isBuiltIn, createdAt"
    });

    // Version 5: Add notification fields and settings table
    this.version(5)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id"
      })
      .upgrade((trans) => {
        // Migrate existing tasks to have notification fields with defaults
        return trans.table("tasks").toCollection().modify((task: TaskRecord) => {
          if (task.notificationEnabled === undefined) {
            task.notificationEnabled = true;
          }
          if (task.notificationSent === undefined) {
            task.notificationSent = false;
          }
        });
      });

    // Version 6: Add dependencies field for task dependencies
    this.version(6)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id"
      })
      .upgrade((trans) => {
        // Migrate existing tasks to have dependencies field with empty array default
        return trans.table("tasks").toCollection().modify((task: TaskRecord) => {
          if (task.dependencies === undefined) {
            task.dependencies = [];
          }
        });
      });

    // Version 7: Add sync support
    this.version(7)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id",
        syncQueue: "id, taskId, operation, timestamp, retryCount",
        syncMetadata: "key",
        deviceInfo: "key"
      })
      .upgrade((trans) => {
        // Initialize sync metadata with defaults
        const deviceId = crypto.randomUUID();

        trans.table("syncMetadata").add({
          key: "sync_config",
          enabled: false,
          userId: null,
          deviceId,
          deviceName: navigator?.userAgent?.includes('Mac') ? 'Mac' : 'Desktop',
          email: null,
          token: null,
          tokenExpiresAt: null,
          lastSyncAt: null,
          vectorClock: {},
          conflictStrategy: "last_write_wins",
          serverUrl: ENV_CONFIG.apiBaseUrl
        });

        // Add deviceInfo
        trans.table("deviceInfo").add({
          key: "device_info",
          deviceId,
          deviceName: navigator?.userAgent?.includes('Mac') ? 'Mac' : 'Desktop',
          createdAt: new Date().toISOString()
        });

        // Migrate existing tasks to have empty vectorClock
        return trans.table("tasks").toCollection().modify((task: TaskRecord) => {
          if (!task.vectorClock) {
            task.vectorClock = {};
          }
        });
      });

    // Version 8: Add completedAt field for Smart Views date filtering
    this.version(8)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id",
        syncQueue: "id, taskId, operation, timestamp, retryCount",
        syncMetadata: "key",
        deviceInfo: "key"
      })
      .upgrade((trans) => {
        // Migrate existing completed tasks to set completedAt = updatedAt as best guess
        return trans.table("tasks").toCollection().modify((task: TaskRecord) => {
          if (task.completed && !task.completedAt) {
            task.completedAt = task.updatedAt;
          }
        });
      });

    // Version 9: Add archivedTasks table and archiveSettings
    this.version(9)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt",
        archivedTasks: "id, quadrant, completed, dueDate, completedAt, archivedAt",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id",
        syncQueue: "id, taskId, operation, timestamp, retryCount",
        syncMetadata: "key",
        deviceInfo: "key",
        archiveSettings: "id"
      })
      .upgrade((trans) => {
        // Initialize archive settings with defaults
        return trans.table("archiveSettings").add({
          id: "settings",
          enabled: false,
          archiveAfterDays: 30
        });
      });

    // Version 10: Add syncHistory table for tracking sync operations
    this.version(10)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt",
        archivedTasks: "id, quadrant, completed, dueDate, completedAt, archivedAt",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id",
        syncQueue: "id, taskId, operation, timestamp, retryCount",
        syncMetadata: "key",
        deviceInfo: "key",
        archiveSettings: "id",
        syncHistory: "id, timestamp, status, deviceId"
      });
  }

}

let dbInstance: GsdDatabase | null = null;

export function getDb(): GsdDatabase {
  if (dbInstance) {
    return dbInstance;
  }


  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }


  dbInstance = new GsdDatabase();
  return dbInstance;
}
