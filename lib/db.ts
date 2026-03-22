import Dexie, { Table } from "dexie";
import type { TaskRecord, NotificationSettings, ArchiveSettings, SyncHistoryRecord, AppPreferences } from "@/lib/types";
import type { SmartView } from "@/lib/filters";
import type { SyncQueueItem, PBSyncConfig, DeviceInfo } from "@/lib/sync/types";
import { createLogger } from "@/lib/logger";

const logger = createLogger("DB");

class GsdDatabase extends Dexie {
  tasks!: Table<TaskRecord, string>;
  archivedTasks!: Table<TaskRecord, string>;
  smartViews!: Table<SmartView, string>;
  notificationSettings!: Table<NotificationSettings, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncMetadata!: Table<PBSyncConfig | DeviceInfo, string>;
  deviceInfo!: Table<DeviceInfo, string>;
  archiveSettings!: Table<ArchiveSettings, string>;
  syncHistory!: Table<SyncHistoryRecord, string>;
  appPreferences!: Table<AppPreferences, string>;

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
        // NOTE: This migration predates the PocketBase migration (v13).
        // Uses `any` because the original SyncConfig type no longer exists.
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
          serverUrl: "",
        });

        // Add deviceInfo
        trans.table("deviceInfo").add({
          key: "device_info",
          deviceId,
          deviceName: navigator?.userAgent?.includes('Mac') ? 'Mac' : 'Desktop',
          createdAt: new Date().toISOString()
        });

        // Migrate existing tasks to have empty vectorClock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return trans.table("tasks").toCollection().modify((task: any) => {
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

    // Version 11: Add appPreferences table for storing user preferences
    this.version(11)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt",
        archivedTasks: "id, quadrant, completed, dueDate, completedAt, archivedAt",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id",
        syncQueue: "id, taskId, operation, timestamp, retryCount",
        syncMetadata: "key",
        deviceInfo: "key",
        archiveSettings: "id",
        syncHistory: "id, timestamp, status, deviceId",
        appPreferences: "id"
      })
      .upgrade((trans) => {
        // Initialize app preferences with defaults
        return trans.table("appPreferences").add({
          id: "preferences",
          pinnedSmartViewIds: [],
          maxPinnedViews: 5
        });
      });

    // Version 12: Add time tracking fields
    this.version(12)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt",
        archivedTasks: "id, quadrant, completed, dueDate, completedAt, archivedAt",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id",
        syncQueue: "id, taskId, operation, timestamp, retryCount",
        syncMetadata: "key",
        deviceInfo: "key",
        archiveSettings: "id",
        syncHistory: "id, timestamp, status, deviceId",
        appPreferences: "id"
      })
      .upgrade((trans) => {
        // Migrate existing tasks to have time tracking fields with defaults
        // Issue #8: Added validation for corrupt data during migration
        return trans.table("tasks").toCollection().modify((task: TaskRecord) => {
          // Initialize timeEntries with validation
          if (task.timeEntries === undefined) {
            task.timeEntries = [];
          } else if (!Array.isArray(task.timeEntries)) {
            // Reset corrupt data to empty array
            logger.warn(`Task ${task.id} had corrupt timeEntries, resetting to []`);
            task.timeEntries = [];
          } else {
            // Validate existing entries structure
            task.timeEntries = task.timeEntries.filter(entry => {
              const isValid = entry && typeof entry.id === 'string' && typeof entry.startedAt === 'string';
              if (!isValid) {
                logger.warn(`Task ${task.id} had invalid time entry, removing`);
              }
              return isValid;
            });
          }

          // Initialize timeSpent with validation
          if (task.timeSpent === undefined) {
            task.timeSpent = 0;
          } else if (typeof task.timeSpent !== 'number' || task.timeSpent < 0 || !Number.isFinite(task.timeSpent)) {
            // Reset corrupt data to 0
            logger.warn(`Task ${task.id} had corrupt timeSpent (${task.timeSpent}), resetting to 0`);
            task.timeSpent = 0;
          }
        });
      });

    // Version 13: PocketBase migration — remove vectorClock, reset sync state
    // Users must re-authenticate with PocketBase after this migration.
    this.version(13)
      .stores({
        tasks: "id, quadrant, completed, dueDate, recurrence, *tags, createdAt, updatedAt, [quadrant+completed], notificationSent, *dependencies, completedAt",
        archivedTasks: "id, quadrant, completed, dueDate, completedAt, archivedAt",
        smartViews: "id, name, isBuiltIn, createdAt",
        notificationSettings: "id",
        syncQueue: "id, taskId, operation, timestamp, retryCount",
        syncMetadata: "key",
        deviceInfo: "key",
        archiveSettings: "id",
        syncHistory: "id, timestamp, status, deviceId",
        appPreferences: "id"
      })
      .upgrade(async (trans) => {
        // 1. Clear sync queue (format changed — no vectorClock)
        await trans.table("syncQueue").clear();

        // 2. Reset sync metadata for PocketBase (user must re-authenticate)
        const existingConfig = await trans.table("syncMetadata").get("sync_config");
        const deviceId = existingConfig?.deviceId || crypto.randomUUID();

        await trans.table("syncMetadata").put({
          key: "sync_config",
          enabled: false,
          userId: null,
          deviceId,
          deviceName: navigator?.userAgent?.substring(0, 50) || "Desktop",
          email: null,
          provider: null,
          lastSyncAt: null,
          consecutiveFailures: 0,
          lastFailureAt: null,
          lastFailureReason: null,
          nextRetryAt: null,
          autoSyncEnabled: true,
          autoSyncIntervalMinutes: 2,
        });

        // 3. Remove encryption_salt entry (no longer needed)
        await trans.table("syncMetadata").delete("encryption_salt").catch(() => {
          // May not exist — that's fine
        });

        // 4. Strip vectorClock from existing tasks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await trans.table("tasks").toCollection().modify((task: any) => {
          delete task.vectorClock;
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await trans.table("archivedTasks").toCollection().modify((task: any) => {
          delete task.vectorClock;
        });

        logger.info("PocketBase migration complete. Please re-authenticate to enable sync.");
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
