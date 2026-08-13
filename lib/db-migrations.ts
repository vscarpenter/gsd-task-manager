import type Dexie from "dexie";
import type { Transaction } from "dexie";
import type { TaskRecord } from "@/lib/types";
import type { SyncQueueItem } from "@/lib/sync/types";
import { createLogger } from "@/lib/logger";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { ARCHIVE_CONFIG, TIME_MS } from "@/lib/constants";

const logger = createLogger("DB");

interface LegacyTaskMigrationRecord {
  vectorClock?: Record<string, number>;
  [key: string]: unknown;
}

const TASKS_V1 = "id, quadrant, completed, dueDate";
const TASKS_V2 = `${TASKS_V1}, recurrence, *tags`;
const TASKS_V3 = `${TASKS_V2}, createdAt, updatedAt, [quadrant+completed]`;
const TASKS_V5 = `${TASKS_V3}, notificationSent`;
const TASKS_V6 = `${TASKS_V5}, *dependencies`;
const TASKS_V8 = `${TASKS_V6}, completedAt`;
const ARCHIVED_TASKS = "id, quadrant, completed, dueDate, completedAt, archivedAt";
// Trash (ADR 0015). Indexed on deletedAt because the retention sweep queries a range.
const DELETED_TASKS = "id, quadrant, completed, dueDate, deletedAt";
const SMART_VIEWS = "id, name, isBuiltIn, createdAt";
const SYNC_QUEUE = "id, taskId, operation, timestamp, retryCount";
const SYNC_QUEUE_WITH_STATUS = `${SYNC_QUEUE}, status`;

const STORES_V4 = { tasks: TASKS_V3, smartViews: SMART_VIEWS };
const STORES_V5 = {
  tasks: TASKS_V5,
  smartViews: SMART_VIEWS,
  notificationSettings: "id",
};
const STORES_V6 = { ...STORES_V5, tasks: TASKS_V6 };
const STORES_V7 = {
  ...STORES_V6,
  syncQueue: SYNC_QUEUE,
  syncMetadata: "key",
  deviceInfo: "key",
};
const STORES_V8 = { ...STORES_V7, tasks: TASKS_V8 };
const STORES_V9 = {
  ...STORES_V8,
  archivedTasks: ARCHIVED_TASKS,
  archiveSettings: "id",
};
const STORES_V10 = { ...STORES_V9, syncHistory: "id, timestamp, status, deviceId" };
const STORES_V11 = { ...STORES_V10, appPreferences: "id" };
const STORES_V14 = { ...STORES_V11, syncQueue: SYNC_QUEUE_WITH_STATUS };
const STORES_V16 = { ...STORES_V14, deletedTasks: DELETED_TASKS };

function migrateTaskEnhancements(transaction: Transaction) {
  return transaction.table("tasks").toCollection().modify((task: TaskRecord) => {
    if (task.recurrence === undefined) task.recurrence = "none";
    if (task.tags === undefined) task.tags = [];
    if (task.subtasks === undefined) task.subtasks = [];
  });
}

function migrateNotificationDefaults(transaction: Transaction) {
  return transaction.table("tasks").toCollection().modify((task: TaskRecord) => {
    if (task.notificationEnabled === undefined) task.notificationEnabled = true;
    if (task.notificationSent === undefined) task.notificationSent = false;
  });
}

function migrateDependencyDefaults(transaction: Transaction) {
  return transaction.table("tasks").toCollection().modify((task: TaskRecord) => {
    if (task.dependencies === undefined) task.dependencies = [];
  });
}

async function migrateLegacySync(transaction: Transaction): Promise<void> {
  const deviceId = crypto.randomUUID();
  const deviceName = globalThis.navigator?.userAgent?.includes("Mac") ? "Mac" : "Desktop";
  await Promise.all([
    transaction.table("syncMetadata").put({
      key: "sync_config", enabled: false, userId: null, deviceId, deviceName,
      email: null, token: null, tokenExpiresAt: null, lastSyncAt: null,
      lastClientUpdatedAt: null, pullCursorVersion: 2,
      vectorClock: {}, conflictStrategy: "last_write_wins", serverUrl: "",
    }),
    transaction.table("deviceInfo").put({
      key: "device_info", deviceId, deviceName, createdAt: new Date().toISOString(),
    }),
    transaction.table("tasks").toCollection().modify((task: LegacyTaskMigrationRecord) => {
      if (!task.vectorClock) task.vectorClock = {};
    }),
  ]);
}

function migrateCompletedDates(transaction: Transaction) {
  return transaction.table("tasks").toCollection().modify((task: TaskRecord) => {
    if (task.completed && !task.completedAt) task.completedAt = task.updatedAt;
  });
}

function seedArchiveSettings(transaction: Transaction) {
  return transaction.table("archiveSettings").put({
    id: "settings", enabled: false, archiveAfterDays: 30,
  });
}

function seedAppPreferences(transaction: Transaction) {
  return transaction.table("appPreferences").put({
    id: "preferences", pinnedSmartViewIds: [], maxPinnedViews: 5, smartViewsEnabled: false,
  });
}

function repairTimeEntries(task: TaskRecord): void {
  if (task.timeEntries === undefined) {
    task.timeEntries = [];
    return;
  }
  if (!Array.isArray(task.timeEntries)) {
    logger.warn(`Task ${task.id} had corrupt timeEntries, resetting to []`);
    task.timeEntries = [];
    return;
  }
  task.timeEntries = task.timeEntries.filter((entry) => {
    const valid = entry && typeof entry.id === "string" && typeof entry.startedAt === "string";
    if (!valid) logger.warn(`Task ${task.id} had invalid time entry, removing`);
    return valid;
  });
}

function repairTimeSpent(task: TaskRecord): void {
  if (task.timeSpent === undefined) {
    task.timeSpent = 0;
    return;
  }
  const invalid = typeof task.timeSpent !== "number" || task.timeSpent < 0 || !Number.isFinite(task.timeSpent);
  if (!invalid) return;
  logger.warn(`Task ${task.id} had corrupt timeSpent (${task.timeSpent}), resetting to 0`);
  task.timeSpent = 0;
}

function migrateTimeTracking(transaction: Transaction) {
  return transaction.table("tasks").toCollection().modify((task: TaskRecord) => {
    repairTimeEntries(task);
    repairTimeSpent(task);
  });
}

function pocketBaseSyncConfig(deviceId: string) {
  return {
    key: "sync_config", enabled: false, userId: null, deviceId,
    deviceName: globalThis.navigator?.userAgent?.substring(0, 50) || "Desktop",
    email: null, provider: null, lastSyncAt: null, lastClientUpdatedAt: null,
    pullCursorVersion: 2, lastServerUpdatedAt: null, consecutiveFailures: 0,
    lastFailureAt: null, lastFailureReason: null, nextRetryAt: null,
    autoSyncEnabled: true, autoSyncIntervalMinutes: 2,
  };
}

async function migratePocketBase(transaction: Transaction): Promise<void> {
  await transaction.table("syncQueue").clear();
  const existing = await transaction.table("syncMetadata").get("sync_config");
  const deviceId = existing?.deviceId || crypto.randomUUID();
  await Promise.all([
    transaction.table("syncMetadata").put(pocketBaseSyncConfig(deviceId)),
    transaction.table("syncMetadata").delete("encryption_salt").catch(() => undefined),
    transaction.table("tasks").toCollection().modify((task: LegacyTaskMigrationRecord) => {
      delete task.vectorClock;
    }),
    transaction.table("archivedTasks").toCollection().modify((task: LegacyTaskMigrationRecord) => {
      delete task.vectorClock;
    }),
  ]);
  logger.info("PocketBase migration complete. Please re-authenticate to enable sync.");
}

function migrateQueueStatus(transaction: Transaction) {
  const maxRetries = 5;
  return transaction.table("syncQueue").toCollection().modify((item: SyncQueueItem) => {
    if (item.status) return;
    item.status = (item.retryCount ?? 0) >= maxRetries ? "failed" : "pending";
    if (item.status === "failed" && !item.failedAt) item.failedAt = Date.now();
  });
}

async function findResurrectedTaskIds(transaction: Transaction): Promise<string[]> {
  const archivedIds = new Set<string>(
    await transaction.table("archivedTasks").toCollection().primaryKeys() as string[]
  );
  const settings = await transaction.table("archiveSettings").get("settings");
  const days = settings?.archiveAfterDays ?? ARCHIVE_CONFIG.DEFAULT_ARCHIVE_AFTER_DAYS;
  const cutoff = new Date(Date.now() - days * TIME_MS.DAY).toISOString();
  return await transaction.table("tasks").filter((task: TaskRecord) =>
    archivedIds.has(task.id) && task.completed && Boolean(task.completedAt) && task.completedAt! < cutoff
  ).primaryKeys() as string[];
}

async function repairLongTitles(transaction: Transaction): Promise<number> {
  let repaired = 0;
  await transaction.table("tasks").toCollection().modify((task: TaskRecord) => {
    if (typeof task.title !== "string") return;
    if (task.title.length <= SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH) return;
    task.title = task.title.slice(0, SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH);
    repaired += 1;
  });
  return repaired;
}

async function repairArchiveResurrection(transaction: Transaction): Promise<void> {
  const resurrected = await findResurrectedTaskIds(transaction);
  if (resurrected.length > 0) await transaction.table("tasks").bulkDelete(resurrected);
  const repairedTitles = await repairLongTitles(transaction);
  logger.info("Archive resurrection cleanup complete", {
    removedDuplicates: resurrected.length,
    repairedTitles,
  });
}

export function registerDatabaseVersions(database: Dexie): void {
  database.version(1).stores({ tasks: TASKS_V1 });
  database.version(2).stores({ tasks: TASKS_V2 }).upgrade(migrateTaskEnhancements);
  database.version(3).stores({ tasks: TASKS_V3 });
  database.version(4).stores(STORES_V4);
  database.version(5).stores(STORES_V5).upgrade(migrateNotificationDefaults);
  database.version(6).stores(STORES_V6).upgrade(migrateDependencyDefaults);
  database.version(7).stores(STORES_V7).upgrade(migrateLegacySync);
  database.version(8).stores(STORES_V8).upgrade(migrateCompletedDates);
  database.version(9).stores(STORES_V9).upgrade(seedArchiveSettings);
  database.version(10).stores(STORES_V10);
  database.version(11).stores(STORES_V11).upgrade(seedAppPreferences);
  database.version(12).stores(STORES_V11).upgrade(migrateTimeTracking);
  database.version(13).stores(STORES_V11).upgrade(migratePocketBase);
  database.version(14).stores(STORES_V14).upgrade(migrateQueueStatus);
  database.version(15).stores(STORES_V14).upgrade(repairArchiveResurrection);
  // v16 adds the trash store. No upgrade function: an empty new table needs no
  // backfill, and existing rows in tasks/archivedTasks are untouched by it.
  database.version(16).stores(STORES_V16);
}
