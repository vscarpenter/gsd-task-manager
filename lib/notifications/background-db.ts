import type { TaskRecord, NotificationSettings } from '@/lib/types';

/** Opening without a version never upgrades the app's schema or creates its stores. */
export function openReminderDatabase(factory: IDBFactory): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let abandoned = false;
    const request = factory.open('GsdTaskManager');
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => resolve(null);
    request.onblocked = () => { abandoned = true; resolve(null); };
    request.onsuccess = () => {
      const db = request.result;
      if (abandoned || !db.objectStoreNames.contains('tasks') || !db.objectStoreNames.contains('notificationSettings')) {
        db.close(); resolve(null); return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function readReminderSnapshot(db: IDBDatabase): Promise<{ tasks: TaskRecord[]; settings?: NotificationSettings }> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks', 'notificationSettings'], 'readonly');
    const tasks = transaction.objectStore('tasks').getAll();
    const settings = transaction.objectStore('notificationSettings').get('settings');
    transaction.oncomplete = () => resolve({ tasks: tasks.result, settings: settings.result });
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export function sameReminder(current: TaskRecord, checked: TaskRecord): boolean {
  return !current.completed && !current.savedAt && current.notificationEnabled !== false &&
    !current.notificationSent && current.dueDate === checked.dueDate &&
    current.notifyBefore === checked.notifyBefore && current.snoozedUntil === checked.snoozedUntil;
}

/** Read/modify/write in one native transaction; no network promise holds it open. */
export function markBackgroundReminder(db: IDBDatabase, checked: TaskRecord, now: Date): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('tasks', 'readwrite');
    const store = transaction.objectStore('tasks');
    const request = store.get(checked.id);
    request.onsuccess = () => {
      const current: TaskRecord | undefined = request.result;
      if (current && sameReminder(current, checked)) {
        store.put({ ...current, notificationSent: true, lastNotificationAt: now.toISOString() });
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}
