// GENERATED FILE. Do not edit by hand.
// Run node scripts/generate-sw-notifications.cjs
(() => {
  // lib/constants.ts
  var TIME_UNITS = {
    SECONDS_PER_MINUTE: 60,
    MINUTES_PER_HOUR: 60,
    MINUTES_PER_DAY: 24 * 60,
    MINUTES_PER_WEEK: 7 * 24 * 60,
    SECONDS_PER_HOUR: 60 * 60,
    MS_PER_SECOND: 1000,
    MS_PER_MINUTE: 60 * 1000
  };
  var TIME_MS = {
    SECOND: TIME_UNITS.MS_PER_SECOND,
    MINUTE: TIME_UNITS.MS_PER_MINUTE,
    HOUR: TIME_UNITS.MINUTES_PER_HOUR * TIME_UNITS.MS_PER_MINUTE,
    DAY: TIME_UNITS.MINUTES_PER_DAY * TIME_UNITS.MS_PER_MINUTE,
    WEEK: TIME_UNITS.MINUTES_PER_WEEK * TIME_UNITS.MS_PER_MINUTE
  };
  var SWIPE_CONFIG = {
    DIRECTION_LOCK_PX: 12,
    BUTTON_WIDTH: 84,
    OPEN_FRACTION: 0.6,
    FULL_SWIPE_FRACTION: 0.5,
    SNOOZE_MINUTES: TIME_UNITS.MINUTES_PER_HOUR
  };
  var NOTIFICATION_TIMING = {
    AUTO_CLOSE_DURATION: 1e4,
    TEST_NOTIFICATION_DURATION: 5000,
    MS_PER_MINUTE: TIME_UNITS.MS_PER_MINUTE,
    MINUTES_PER_HOUR: TIME_UNITS.MINUTES_PER_HOUR,
    MINUTES_PER_DAY: TIME_UNITS.MINUTES_PER_DAY,
    OVERDUE_NOTIFICATION_THRESHOLD: -60,
    DEFAULT_CHECK_INTERVAL_MINUTES: 1,
    BACKGROUND_SYNC_INTERVAL_MINUTES: 15,
    DEFAULT_REMINDER_MINUTES: 15
  };
  var TIME_TRACKING = {
    MS_PER_MINUTE: TIME_UNITS.MS_PER_MINUTE,
    MINUTES_PER_HOUR: TIME_UNITS.MINUTES_PER_HOUR,
    MINUTES_PER_DAY: TIME_UNITS.MINUTES_PER_DAY,
    MINUTES_PER_WEEK: TIME_UNITS.MINUTES_PER_WEEK,
    MAX_SNOOZE_MINUTES: 365 * 24 * 60,
    SECONDS_PER_MINUTE: TIME_UNITS.SECONDS_PER_MINUTE,
    SECONDS_PER_HOUR: TIME_UNITS.SECONDS_PER_HOUR
  };

  // lib/due-time.ts
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function timeOf(iso) {
    const d = new Date(iso);
    const atMidnight = d.getHours() + d.getMinutes() + d.getSeconds() + d.getMilliseconds() === 0;
    return atMidnight ? undefined : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // lib/notifications/reminder-window.ts
  var ALL_DAY_REMINDER_HOUR = 9;
  var GRACE_MS = -NOTIFICATION_TIMING.OVERDUE_NOTIFICATION_THRESHOLD * NOTIFICATION_TIMING.MS_PER_MINUTE;
  function reminderWindow(dueIso, notifyBeforeMinutes, quiet = {}) {
    const due = new Date(dueIso);
    if (timeOf(dueIso)) {
      const timedFire = new Date(due.getTime() - notifyBeforeMinutes * NOTIFICATION_TIMING.MS_PER_MINUTE);
      const deferred = deferPastQuietHours(timedFire, quiet);
      return { fire: deferred, expires: new Date(Math.max(due.getTime(), deferred.getTime()) + GRACE_MS) };
    }
    const wholeDays = Math.floor(notifyBeforeMinutes / NOTIFICATION_TIMING.MINUTES_PER_DAY);
    const planned = new Date(due.getFullYear(), due.getMonth(), due.getDate() - wholeDays, ALL_DAY_REMINDER_HOUR);
    const fire = deferPastQuietHours(planned, quiet);
    return { fire, expires: new Date(fire.getTime() + GRACE_MS) };
  }
  function minutesOfDay(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  function isQuietAt(quiet, now) {
    if (!quiet.start || !quiet.end)
      return false;
    const start = minutesOfDay(quiet.start);
    const end = minutesOfDay(quiet.end);
    const at = now.getHours() * 60 + now.getMinutes();
    return start > end ? at >= start || at < end : at >= start && at < end;
  }
  function deferPastQuietHours(fire, quiet) {
    if (!quiet.start || !quiet.end)
      return fire;
    const end = minutesOfDay(quiet.end);
    if (!isQuietAt(quiet, fire))
      return fire;
    const endToday = new Date(fire.getFullYear(), fire.getMonth(), fire.getDate(), Math.floor(end / 60), end % 60);
    return endToday > fire ? endToday : new Date(fire.getFullYear(), fire.getMonth(), fire.getDate() + 1, Math.floor(end / 60), end % 60);
  }
  function isReminderDue(args) {
    const { now, quiet = {} } = args;
    const snoozed = args.snoozedUntil ? new Date(args.snoozedUntil) : undefined;
    if (snoozed && snoozed > now)
      return false;
    const within = (window) => now >= window.fire && now < window.expires;
    const planned = reminderWindow(args.dueIso, args.notifyBefore, quiet);
    if (within(planned))
      return true;
    if (!snoozed)
      return false;
    const fire = deferPastQuietHours(snoozed, quiet);
    if (fire < planned.fire)
      return false;
    return within({ fire, expires: new Date(fire.getTime() + GRACE_MS) });
  }

  // lib/notifications/coordination.ts
  var NOTIFICATION_LOCK = "gsd-notification-check";
  var CONTROL_CACHE = "gsd-control-v1";
  var RESET_MARKER_URL = "/.gsd-reset-pending";

  // lib/notifications/background-db.ts
  function openReminderDatabase(factory) {
    return new Promise((resolve) => {
      let abandoned = false;
      const request = factory.open("GsdTaskManager");
      request.onupgradeneeded = () => request.transaction?.abort();
      request.onerror = () => resolve(null);
      request.onblocked = () => {
        abandoned = true;
        resolve(null);
      };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned || !db.objectStoreNames.contains("tasks") || !db.objectStoreNames.contains("notificationSettings")) {
          db.close();
          resolve(null);
          return;
        }
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }
  function readReminderSnapshot(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tasks", "notificationSettings"], "readonly");
      const tasks = transaction.objectStore("tasks").getAll();
      const settings = transaction.objectStore("notificationSettings").get("settings");
      transaction.oncomplete = () => resolve({ tasks: tasks.result, settings: settings.result });
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
  function sameReminder(current, checked) {
    return !current.completed && !current.savedAt && current.notificationEnabled !== false && !current.notificationSent && current.dueDate === checked.dueDate && current.notifyBefore === checked.notifyBefore && current.snoozedUntil === checked.snoozedUntil;
  }
  function markBackgroundReminder(db, checked, now) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("tasks", "readwrite");
      const store = transaction.objectStore("tasks");
      const request = store.get(checked.id);
      request.onsuccess = () => {
        const current = request.result;
        if (current && sameReminder(current, checked)) {
          store.put({ ...current, notificationSent: true, lastNotificationAt: now.toISOString() });
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // lib/notifications/background.ts
  function isDue(task, settings, now) {
    return !task.completed && !task.savedAt && task.notificationEnabled !== false && typeof task.dueDate === "string" && typeof task.title === "string" && isReminderDue({
      dueIso: task.dueDate,
      notifyBefore: task.notifyBefore ?? settings.defaultReminder,
      now,
      snoozedUntil: task.snoozedUntil,
      quiet: { start: settings.quietHoursStart, end: settings.quietHoursEnd }
    });
  }
  async function isResetPending(context) {
    const cache = await context.caches.open(CONTROL_CACHE);
    return Boolean(await cache.match(RESET_MARKER_URL));
  }
  async function notifyTask(context, db, task, settings, now) {
    if (task.notificationSent || await isResetPending(context))
      return;
    try {
      await context.registration.showNotification(`Task reminder: ${task.title}`, {
        body: task.description || "Your task is due soon",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `task-${task.id}`,
        silent: !settings.soundEnabled,
        renotify: true,
        data: { taskId: task.id, dueDate: task.dueDate }
      });
      await markBackgroundReminder(db, task, now);
    } catch {}
  }
  async function checkDatabase(context, now) {
    if (await isResetPending(context))
      return;
    const db = await openReminderDatabase(context.indexedDB);
    if (!db)
      return;
    try {
      const { tasks, settings } = await readReminderSnapshot(db);
      if (!settings)
        return;
      const quiet = { start: settings.quietHoursStart, end: settings.quietHoursEnd };
      const due = settings.enabled && !isQuietAt(quiet, now) ? tasks.filter((task) => isDue(task, settings, now)) : [];
      for (const task of due) {
        await notifyTask(context, db, task, settings, now);
      }
      if (due.length)
        await context.navigator.setAppBadge?.(due.length);
      else
        await context.navigator.clearAppBadge?.();
    } finally {
      db.close();
    }
  }
  async function runBackgroundNotifications(context, now = new Date) {
    if (context.Notification?.permission !== "granted" || !context.navigator.locks || !context.caches)
      return;
    try {
      await context.navigator.locks.request(NOTIFICATION_LOCK, () => checkDatabase(context, now));
    } catch {}
  }

  // lib/notifications/worker-entry.ts
  var worker = globalThis;
  worker.checkBackgroundNotifications = () => runBackgroundNotifications(worker);
})();
