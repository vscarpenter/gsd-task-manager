import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/test-fixtures';
import { waitForAppLoad } from './helpers/test-helpers';

async function seed(page: Page, stores: Record<string, unknown[]>) {
  await page.evaluate((data) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('GsdTaskManager');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(Object.keys(data), 'readwrite');
      for (const [name, rows] of Object.entries(data)) {
        for (const row of rows) transaction.objectStore(name).put(row);
      }
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), stores);
  await page.reload();
}

async function stored(page: Page, table: string, id: string) {
  return page.evaluate(({ table, id }) => new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
    const request = indexedDB.open('GsdTaskManager');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(table, 'readonly');
      const record = transaction.objectStore(table).get(id);
      transaction.oncomplete = () => { db.close(); resolve(record.result); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }), { table, id });
}

function task(id: string, title: string, tags: string[] = []) {
  return {
    id, title, description: '', urgent: true, important: true, quadrant: 'urgent-important',
    completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    recurrence: 'none', tags, subtasks: [], dependencies: [], timeEntries: [], timeSpent: 0,
    notificationEnabled: false, notificationSent: false, estimatedMinutes: 30,
  };
}

test.describe('review remediation', () => {
  test.beforeEach(async ({ page, clearIndexedDB }) => { await waitForAppLoad(page); });

  test('preserves a pending subtask, guards discard, and blocks the palette behind an editor', async ({ page }) => {
    await seed(page, { tasks: [task('review-editor', 'Draft protection')] });
    const card = page.getByTestId('task-card').filter({ hasText: 'Draft protection' });
    await card.hover();
    await card.getByRole('button', { name: 'Edit task', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Draft protection');
    await page.getByLabel('Add a subtask', { exact: true }).fill('Save this without Enter');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByPlaceholder('Search tasks, actions, settings...')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByText('Discard unsaved changes?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByLabel('Add a subtask', { exact: true })).toHaveCount(0);
    expect(await stored(page, 'tasks', 'review-editor')).toMatchObject({ subtasks: [{ title: 'Save this without Enter', completed: false }] });
  });

  test('starts and stops a timer from the matrix and persists both states', async ({ page }) => {
    await seed(page, { tasks: [task('review-timer', 'Track this work')] });
    const card = page.getByTestId('task-card').filter({ hasText: 'Track this work' });
    await card.getByRole('button', { name: /start timer/i }).click();
    await expect(card.getByRole('button', { name: /stop timer/i })).toBeVisible();
    expect(await stored(page, 'tasks', 'review-timer')).toMatchObject({ timeEntries: [{ startedAt: expect.any(String) }] });
    await card.getByRole('button', { name: /stop timer/i }).click();
    await expect(card.getByRole('button', { name: /start timer/i })).toBeVisible();
    expect(await stored(page, 'tasks', 'review-timer')).toMatchObject({ timeEntries: [{ endedAt: expect.any(String) }] });
  });

  test('reveals a global palette result outside the selected Smart View', async ({ page }) => {
    const now = new Date().toISOString();
    await seed(page, {
      tasks: [task('review-home', 'Home task', ['home']), task('review-outside', 'Outside selected view', ['work'])],
      appPreferences: [{ id: 'preferences', smartViewsEnabled: true, pinnedSmartViewIds: [], maxPinnedViews: 5 }],
      smartViews: [{ id: 'only-home', name: 'Only home', icon: '⌂', criteria: { tags: ['home'] }, isBuiltIn: false, createdAt: now, updatedAt: now }],
    });
    await page.getByRole('button', { name: /more smart views/i }).click();
    await page.getByRole('menuitem', { name: /only home/i }).click();
    await expect(page.getByTestId('task-card').filter({ hasText: 'Outside selected view' })).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByPlaceholder('Search tasks, actions, settings...').fill('Outside selected view');
    await page.getByRole('option').filter({ hasText: 'Outside selected view' }).click();
    const found = page.getByTestId('task-card').filter({ hasText: 'Outside selected view' });
    await expect(found).toBeVisible();
    await expect(found).toHaveClass(/ring-4/);
    await expect(found).toBeFocused();
  });

  test('opens the Field Guide after its code loads on demand', async ({ page }) => {
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'How to use GSD' })).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'How to use GSD' })).toHaveCount(0);
  });
});

test.describe('failed sync recovery', () => {
  // The seeded account has no external backend; only connection failures are expected.
  test.use({ expectedConsoleErrors: /Failed to load resource|ERR_FAILED|ERR_CONNECTION_REFUSED|Cross-Origin Request Blocked|establish a connection|Refused to connect|Content[- ]Security[- ]Policy|\/api\/realtime/ });
  test.beforeEach(async ({ page, clearIndexedDB }) => {
    await page.route('https://api.vinny.io/**', (route) => route.abort());
    await waitForAppLoad(page);
  });

  test('shows failed operations and dismisses into Trash', async ({ page }) => {
    const local = task('review-failed', 'Keep my unsynced changes');
    await seed(page, {
      tasks: [local],
      syncMetadata: [{ key: 'sync_config', enabled: true, userId: 'review-user', localTaskOwnerUserId: 'review-user', deviceId: 'review-device', deviceName: 'Review', email: 'review@example.test', provider: 'google', lastSyncAt: null, lastSuccessfulSyncAt: null, consecutiveFailures: 0, lastFailureAt: null, lastFailureReason: null, nextRetryAt: null, autoSyncEnabled: false }],
      syncQueue: [{ id: 'review-failed-row', taskId: local.id, operation: 'update', timestamp: Date.now(), retryCount: 5, status: 'failed', lastError: 'validation_failed', payload: local }],
    });
    await page.goto('/settings#sync');
    const region = page.getByRole('region', { name: 'Failed sync operations' });
    await expect(region).toContainText(local.title);
    await expect(region.getByRole('button', { name: `Retry ${local.title}`, exact: true })).toBeEnabled();
    await region.getByRole('button', { name: `Dismiss ${local.title}`, exact: true }).click();
    await expect(region).toHaveCount(0);
    expect(await stored(page, 'tasks', local.id)).toBeUndefined();
    expect(await stored(page, 'deletedTasks', local.id)).toMatchObject({ title: local.title });
  });
});
