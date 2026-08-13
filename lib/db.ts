import Dexie, { Table } from "dexie";
import type {
  TaskRecord,
  NotificationSettings,
  ArchiveSettings,
  SyncHistoryRecord,
  AppPreferences,
} from "@/lib/types";
import type { SmartView } from "@/lib/filters";
import type { SyncQueueItem, PBSyncConfig, DeviceInfo } from "@/lib/sync/types";
import { registerDatabaseVersions } from "@/lib/db-migrations";

class GsdDatabase extends Dexie {
  tasks!: Table<TaskRecord, string>;
  archivedTasks!: Table<TaskRecord, string>;
  /** Trash — see docs/adr/0015-trash-with-retention.md. */
  deletedTasks!: Table<TaskRecord, string>;
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
    registerDatabaseVersions(this);
  }
}

let dbInstance: GsdDatabase | null = null;

export function getDb(): GsdDatabase {
  if (dbInstance) return dbInstance;
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
  dbInstance = new GsdDatabase();
  return dbInstance;
}
