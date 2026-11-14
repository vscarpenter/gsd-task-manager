import type { NotificationSettings, TaskRecord } from '@/lib/types';
import { isReminderDue, isQuietAt } from './reminder-window';
import { CONTROL_CACHE, NOTIFICATION_LOCK, RESET_MARKER_URL } from './coordination';
import { markBackgroundReminder, openReminderDatabase, readReminderSnapshot } from './background-db';

export interface BackgroundContext {
  indexedDB: IDBFactory;
  Notification: { permission: NotificationPermission };
  registration: { showNotification: (title: string, options: NotificationOptions & { renotify?: boolean }) => Promise<void> };
  navigator: {
    locks?: { request: (name: string, run: () => Promise<void>) => Promise<void> };
    setAppBadge?: (count: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  caches: { open: (name: string) => Promise<{ match: (key: string) => Promise<Response | undefined> }> };
}

function isDue(task: TaskRecord, settings: NotificationSettings, now: Date): boolean {
  return !task.completed && !task.savedAt && task.notificationEnabled !== false &&
    typeof task.dueDate === 'string' && typeof task.title === 'string' &&
    isReminderDue({ dueIso: task.dueDate, notifyBefore: task.notifyBefore ?? settings.defaultReminder,
      now, snoozedUntil: task.snoozedUntil,
      quiet: { start: settings.quietHoursStart, end: settings.quietHoursEnd } });
}

async function isResetPending(context: BackgroundContext): Promise<boolean> {
  const cache = await context.caches.open(CONTROL_CACHE);
  return Boolean(await cache.match(RESET_MARKER_URL));
}

async function notifyTask(context: BackgroundContext, db: IDBDatabase, task: TaskRecord, settings: NotificationSettings, now: Date): Promise<void> {
  if (task.notificationSent || await isResetPending(context)) return;
  try {
    await context.registration.showNotification(`Task reminder: ${task.title}`, {
      body: task.description || 'Your task is due soon',
      icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
      tag: `task-${task.id}`, silent: !settings.soundEnabled, renotify: true,
      data: { taskId: task.id, dueDate: task.dueDate },
    });
    await markBackgroundReminder(db, task, now);
  } catch {
    // A failed display remains eligible for the next periodic event.
  }
}

async function checkDatabase(context: BackgroundContext, now: Date): Promise<void> {
  if (await isResetPending(context)) return;
  const db = await openReminderDatabase(context.indexedDB);
  if (!db) return;
  try {
    const { tasks, settings } = await readReminderSnapshot(db);
    if (!settings) return;
    const quiet = { start: settings.quietHoursStart, end: settings.quietHoursEnd };
    const due = settings.enabled && !isQuietAt(quiet, now) ? tasks.filter((task) => isDue(task, settings, now)) : [];
    for (const task of due) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- serialized display/mark while holding the origin-wide notification lock
      await notifyTask(context, db, task, settings, now);
    }
    if (due.length) await context.navigator.setAppBadge?.(due.length);
    else await context.navigator.clearAppBadge?.();
  } finally {
    db.close();
  }
}

/** Page and worker checks serialize through the same origin-wide Web Lock. */
export async function runBackgroundNotifications(context: BackgroundContext, now = new Date()): Promise<void> {
  if (context.Notification?.permission !== 'granted' || !context.navigator.locks || !context.caches) return;
  try {
    await context.navigator.locks.request(NOTIFICATION_LOCK, () => checkDatabase(context, now));
  } catch {
    // Unsupported/unavailable local storage must not create a DB or mark reminders.
  }
}
