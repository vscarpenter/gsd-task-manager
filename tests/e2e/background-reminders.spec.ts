import { test, expect } from './fixtures/test-fixtures';
import { waitForAppLoad } from './helpers/test-helpers';

// The headless shell denies notification permission; use Chromium's full
// headless channel for this real API test (playwright#23954).
test.use({ serviceWorkerEnabled: true, channel: 'chromium' });
test.skip(({ browserName }) => browserName !== 'chromium', 'Periodic background sync is a Chromium enhancement.'); // NOSONAR -- Firefox/WebKit do not implement this API; Chromium still runs the test.

test('a real periodic worker checks IndexedDB while the app is closed', async ({ page, context, clearIndexedDB }) => {
  await context.grantPermissions(['notifications'], { origin: new URL(page.url()).origin });
  await waitForAppLoad(page);
  expect(await page.evaluate(() => Notification.permission)).toBe('granted');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const version = new Date().toISOString();
  await page.evaluate((updatedAt) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('GsdTaskManager');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['tasks', 'notificationSettings'], 'readwrite');
      transaction.objectStore('tasks').put({
        id: 'periodic-worker-task', title: 'Background reminder verification', description: '',
        urgent: true, important: true, quadrant: 'urgent-important', completed: false,
        createdAt: updatedAt, updatedAt, dueDate: new Date(Date.now() + 600_000).toISOString(),
        recurrence: 'none', tags: [], subtasks: [], dependencies: [], timeEntries: [],
        notificationEnabled: true, notificationSent: false, notifyBefore: 15,
      });
      transaction.objectStore('notificationSettings').put({ id: 'settings', enabled: true, defaultReminder: 15, soundEnabled: false, permissionAsked: true, updatedAt });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), version);
  await page.close();

  const outcome = await worker.evaluate(async () => {
    const scope = globalThis as unknown as {
      checkBackgroundNotifications: () => Promise<void>;
      registration: ServiceWorkerRegistration;
    };
    const calls: string[] = [];
    const display = scope.registration.showNotification.bind(scope.registration);
    scope.registration.showNotification = async (...args) => {
      try { await display(...args); calls.push('shown'); }
      catch (error) { calls.push(String(error)); throw error; }
    };
    await scope.checkBackgroundNotifications();
    const read = () => new Promise<{ notificationSent: boolean; updatedAt: string; lastNotificationAt?: string }>((resolve, reject) => {
      const request = indexedDB.open('GsdTaskManager');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('tasks');
        const row = transaction.objectStore('tasks').get('periodic-worker-task');
        transaction.oncomplete = () => { db.close(); resolve(row.result); };
      };
    });
    const first = await read();
    await scope.checkBackgroundNotifications();
    const second = await read();
    const notifications = await scope.registration.getNotifications({ tag: 'task-periodic-worker-task' });
    notifications.forEach((notification) => notification.close());
    return { first, second, displayed: notifications.length, calls,
      permission: Notification.permission, asyncPermission: (await navigator.permissions.query({ name: 'notifications' })).state,
      locks: Boolean(navigator.locks) };
  });
  expect(outcome.first, JSON.stringify(outcome)).toMatchObject({ notificationSent: true, updatedAt: version });
  expect(outcome.first.lastNotificationAt).toBeTruthy();
  expect(outcome.second.lastNotificationAt).toBe(outcome.first.lastNotificationAt);
  // Headless Chromium accepts the real API request without an OS notification center.
  expect(outcome.calls).toEqual(['shown']);
});
