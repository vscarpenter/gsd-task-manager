import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { EventSource } from 'eventsource';
import PocketBase from 'pocketbase';
import { chromium, type Browser, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetTaskCache } from '../../cache.js';
import { clearPocketBase } from '../../pocketbase-client.js';

const POCKETBASE_BIN = process.env.POCKETBASE_BIN;
const describeSystem = POCKETBASE_BIN ? describe : describe.skip;
const REPO_ROOT = resolve(import.meta.dirname, '../../../../..');
const ADMIN_EMAIL = 'system-admin@example.test';
const ADMIN_PASSWORD = 'local-system-admin-1234';
const USER_PASSWORD = 'local-user-password-1234';

Object.defineProperty(globalThis, 'EventSource', {
  configurable: true,
  value: EventSource,
});

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not allocate a local PocketBase port'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });
}

async function waitForHealth(baseUrl: string, process: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`PocketBase exited before readiness with ${process.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The listener is not ready yet.
    }
    await delay(100);
  }
  throw new Error('PocketBase did not become healthy within 15 seconds');
}

async function waitForValue<T>(read: () => T | undefined, label: string): Promise<T> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined) return value;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForAsyncValue<T>(
  read: () => Promise<T | undefined>,
  label: string,
  timeoutMs = 10_000
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForHttp(
  url: string,
  process: ChildProcessWithoutNullStreams,
  output: () => string
): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`App server exited before readiness with ${process.exitCode}\n${output()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Next is still compiling.
    }
    await delay(200);
  }
  throw new Error(`App server did not become ready within 90 seconds\n${output()}`);
}

async function stopProcess(process: ChildProcessWithoutNullStreams | undefined): Promise<void> {
  if (!process || process.exitCode !== null) return;
  process.kill('SIGTERM');
  const deadline = Date.now() + 5_000;
  while (process.exitCode === null && Date.now() < deadline) {
    await delay(25);
  }
  if (process.exitCode === null) process.kill('SIGKILL');
}

function remoteTask(ownerId: string, taskId: string, title: string, deviceId = 'remote-system') {
  const now = new Date().toISOString();
  return {
    task_id: taskId,
    owner: ownerId,
    title,
    description: '',
    urgent: false,
    important: true,
    quadrant: 'not-urgent-important',
    due_date: '',
    completed: false,
    completed_at: '',
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notification_enabled: true,
    notification_sent: false,
    notify_before: null,
    last_notification_at: '',
    estimated_minutes: null,
    time_spent: 0,
    time_entries: [],
    snoozed_until: '',
    client_updated_at: now,
    client_created_at: now,
    device_id: deviceId,
  };
}

async function seedBrowserSync(page: Page, userId: string, email: string): Promise<void> {
  await page.evaluate(
    async ({ userId: browserUserId, email: browserEmail }) => {
      const database = await new Promise<IDBDatabase>((resolveDatabase, reject) => {
        const request = indexedDB.open('GsdTaskManager');
        request.onsuccess = () => resolveDatabase(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction('syncMetadata', 'readwrite');
      const store = transaction.objectStore('syncMetadata');
      const current = await new Promise<Record<string, unknown>>((resolveRecord, reject) => {
        const request = store.get('sync_config');
        request.onsuccess = () => resolveRecord(request.result ?? {});
        request.onerror = () => reject(request.error);
      });
      store.put({
        ...current,
        key: 'sync_config',
        enabled: true,
        userId: browserUserId,
        localTaskOwnerUserId: browserUserId,
        email: browserEmail,
        provider: 'password-system-test',
        deviceId: 'browser-system-device',
        deviceName: 'Chromium system test',
        lastSyncAt: null,
        lastClientUpdatedAt: null,
        pullCursorVersion: 2,
        lastServerUpdatedAt: null,
        lastSuccessfulSyncAt: null,
        consecutiveFailures: 0,
        lastFailureAt: null,
        lastFailureReason: null,
        nextRetryAt: null,
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 2,
      });
      await new Promise<void>((resolveTransaction, reject) => {
        transaction.oncomplete = () => resolveTransaction();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
    },
    { userId, email }
  );
}

async function setBrowserAutoSync(page: Page, enabled: boolean): Promise<void> {
  await page.evaluate(async (autoSyncEnabled) => {
    const database = await new Promise<IDBDatabase>((resolveDatabase, reject) => {
      const request = indexedDB.open('GsdTaskManager');
      request.onsuccess = () => resolveDatabase(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('syncMetadata', 'readwrite');
    const store = transaction.objectStore('syncMetadata');
    const config = await new Promise<Record<string, unknown>>((resolveRecord, reject) => {
      const request = store.get('sync_config');
      request.onsuccess = () => resolveRecord(request.result);
      request.onerror = () => reject(request.error);
    });
    store.put({ ...config, autoSyncEnabled });
    await new Promise<void>((resolveTransaction, reject) => {
      transaction.oncomplete = () => resolveTransaction();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, enabled);
}

async function archiveBrowserTask(page: Page, taskId: string): Promise<string> {
  return page.evaluate(async (browserTaskId) => {
    const database = await new Promise<IDBDatabase>((resolveDatabase, reject) => {
      const request = indexedDB.open('GsdTaskManager');
      request.onsuccess = () => resolveDatabase(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['tasks', 'archivedTasks', 'syncMetadata'],
      'readwrite'
    );
    const tasks = transaction.objectStore('tasks');
    const archivedTasks = transaction.objectStore('archivedTasks');
    const syncMetadata = transaction.objectStore('syncMetadata');
    const task = await new Promise<Record<string, unknown>>((resolveTask, reject) => {
      const request = tasks.get(browserTaskId);
      request.onsuccess = () => resolveTask(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!task) throw new Error(`Browser task ${browserTaskId} was not found`);
    const archivedAt = new Date().toISOString();
    archivedTasks.put({ ...task, archivedAt });
    tasks.delete(browserTaskId);

    const config = await new Promise<Record<string, unknown>>((resolveConfig, reject) => {
      const request = syncMetadata.get('sync_config');
      request.onsuccess = () => resolveConfig(request.result);
      request.onerror = () => reject(request.error);
    });
    syncMetadata.put({
      ...config,
      lastClientUpdatedAt: null,
      pullCursorVersion: 2,
      lastServerUpdatedAt: null,
    });

    await new Promise<void>((resolveTransaction, reject) => {
      transaction.oncomplete = () => resolveTransaction();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    return archivedAt;
  }, taskId);
}

async function clickBrowserSync(page: Page): Promise<void> {
  const syncButton = page.getByTestId('sync-button');
  await syncButton.waitFor({ state: 'visible' });
  await syncButton.click();
}

describeSystem('PocketBase authenticated system boundary', () => {
  let handleToolCall: typeof import('../../tools/handlers/index.js').handleToolCall;
  let dataDirectory = '';
  let migrationsDirectory = '';
  let encryptionKey = '';
  let pocketBaseProcess: ChildProcessWithoutNullStreams | undefined;
  let baseUrl = '';
  let processOutput = '';

  beforeAll(async () => {
    ({ handleToolCall } = await import('../../tools/handlers/index.js'));
    dataDirectory = mkdtempSync(join(tmpdir(), 'gsd-pocketbase-data-'));
    migrationsDirectory = mkdtempSync(join(tmpdir(), 'gsd-pocketbase-fresh-migrations-'));
    copyFileSync(
      resolve(REPO_ROOT, 'docker/pb_fresh_migrations/1781000000_encrypt_existing_tasks.js'),
      join(migrationsDirectory, '1781000000_encrypt_existing_tasks.js')
    );
    copyFileSync(
      resolve(REPO_ROOT, 'docker/pb_migrations/1781100000_harden_task_encryption_cleanup.js'),
      join(migrationsDirectory, '1781100000_harden_task_encryption_cleanup.js')
    );
    encryptionKey = randomBytes(16).toString('hex');
    const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}`;

    execFileSync(
      POCKETBASE_BIN!,
      ['superuser', 'upsert', ADMIN_EMAIL, ADMIN_PASSWORD, `--dir=${dataDirectory}`],
      { cwd: REPO_ROOT, stdio: 'pipe' }
    );

    execFileSync(
      POCKETBASE_BIN!,
      [
        'migrate',
        'up',
        `--dir=${dataDirectory}`,
        '--automigrate=false',
        `--hooksDir=${resolve(REPO_ROOT, 'docker/pb_hooks')}`,
        `--migrationsDir=${migrationsDirectory}`,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, GSD_TASKS_ENC_KEY: encryptionKey },
        stdio: 'pipe',
      }
    );

    pocketBaseProcess = spawn(
      POCKETBASE_BIN!,
      [
        'serve',
        `--dir=${dataDirectory}`,
        '--automigrate=false',
        `--hooksDir=${resolve(REPO_ROOT, 'docker/pb_hooks')}`,
        `--migrationsDir=${migrationsDirectory}`,
        `--http=127.0.0.1:${port}`,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, GSD_TASKS_ENC_KEY: encryptionKey },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    pocketBaseProcess.stdout.on('data', (chunk) => {
      processOutput += chunk.toString();
    });
    pocketBaseProcess.stderr.on('data', (chunk) => {
      processOutput += chunk.toString();
    });

    try {
      await waitForHealth(baseUrl, pocketBaseProcess);
    } catch (error) {
      throw new Error(`${String(error)}\nPocketBase output:\n${processOutput}`);
    }

    const bootstrapAdmin = new PocketBase(baseUrl);
    await bootstrapAdmin
      .collection('_superusers')
      .authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    const initialCollections = await bootstrapAdmin.collections.getFullList();
    if (!initialCollections.some((collection) => collection.name === 'tasks')) {
      try {
        execFileSync('bash', ['scripts/setup-pocketbase-collections.sh'], {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            PB_URL: baseUrl,
            PB_ADMIN_EMAIL: ADMIN_EMAIL,
            PB_ADMIN_PASSWORD: ADMIN_PASSWORD,
          },
          stdio: 'pipe',
        });
      } catch (error) {
        const failure = error as { stdout?: Buffer; stderr?: Buffer };
        throw new Error(
          `Collection setup failed:\n${failure.stdout?.toString() ?? ''}${failure.stderr?.toString() ?? ''}`
        );
      }
    }

    try {
      execFileSync('bash', ['scripts/setup-pocketbase-feedback-collection.sh'], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          PB_URL: baseUrl,
          PB_ADMIN_EMAIL: ADMIN_EMAIL,
          PB_ADMIN_PASSWORD: ADMIN_PASSWORD,
        },
        stdio: 'pipe',
      });
    } catch (error) {
      const failure = error as { stdout?: Buffer; stderr?: Buffer };
      throw new Error(
        'Feedback setup failed:\n' +
          (failure.stdout?.toString() ?? '') +
          (failure.stderr?.toString() ?? '')
      );
    }
  }, 30_000);

  afterAll(async () => {
    clearPocketBase();
    resetTaskCache();
    if (pocketBaseProcess && pocketBaseProcess.exitCode === null) {
      pocketBaseProcess.kill('SIGTERM');
      const deadline = Date.now() + 5_000;
      while (pocketBaseProcess.exitCode === null && Date.now() < deadline) {
        await delay(25);
      }
      if (pocketBaseProcess.exitCode === null) pocketBaseProcess.kill('SIGKILL');
    }
    if (dataDirectory) rmSync(dataDirectory, { recursive: true, force: true });
    if (migrationsDirectory) rmSync(migrationsDirectory, { recursive: true, force: true });
  });

  it('proves anonymous feedback stays write-only behind installed abuse controls', async () => {
    const admin = new PocketBase(baseUrl);
    await admin.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

    const markerResponse = await fetch(baseUrl + '/api/gsd/feedback-controls', {
      headers: { Authorization: admin.authStore.token },
    });
    expect(markerResponse.status).toBe(200);
    expect(await markerResponse.json()).toMatchObject({
      hookVersion: 1,
      ready: true,
      accepting: true,
      quotaLimit: 10000,
      retentionDays: 180,
    });

    const unauthenticatedMarker = await fetch(baseUrl + '/api/gsd/feedback-controls');
    expect(unauthenticatedMarker.status).toBe(401);

    const submissionId = 'system-feedback-' + randomBytes(8).toString('hex');
    const anonymous = new PocketBase(baseUrl);
    const created = await anonymous.collection('feedback').create({
      submission_id: submissionId,
      sentiment: 'up',
      category: 'praise',
      message: 'System boundary test',
      votes: {},
      app_version: 'system',
      client_submitted_at: new Date().toISOString(),
    });
    expect(created.submission_id).toBe(submissionId);

    await expect(anonymous.collection('feedback').getFullList()).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      anonymous.collection('feedback').create({
        submission_id: submissionId,
        message: 'Duplicate',
      })
    ).rejects.toMatchObject({ status: 400 });

    const stored = await admin.collection('feedback').getFullList();
    expect(stored.map((record) => record.submission_id)).toContain(submissionId);

    // The setup intentionally enables PocketBase's global limiter, including
    // pre-existing auth rules. Disable it only in this ephemeral fixture so the
    // later browser test can perform its intentionally bursty auth sequence.
    const settingsResponse = await fetch(baseUrl + '/api/settings', {
      headers: { Authorization: admin.authStore.token },
    });
    expect(settingsResponse.status).toBe(200);
    const settings = (await settingsResponse.json()) as {
      rateLimits: Record<string, unknown>;
    };
    const resetResponse = await fetch(baseUrl + '/api/settings', {
      method: 'PATCH',
      headers: {
        Authorization: admin.authStore.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rateLimits: { ...settings.rateLimits, enabled: false },
      }),
    });
    expect(resetResponse.status).toBe(200);
  });

  it('proves MCP writes, owner isolation, realtime delivery, and ciphertext at rest', async () => {
    const unknownResponse = await handleToolCall('not_registered', {}, {
      pocketBaseUrl: baseUrl,
      authToken: 'unused-for-dispatch-rejection',
    });
    expect(unknownResponse.isError).toBe(true);
    expect(unknownResponse.content[0]?.text).toContain('Unknown tool: not_registered');

    const admin = new PocketBase(baseUrl);
    await admin.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    const collections = await admin.collections.getFullList();
    if (!collections.some((collection) => collection.name === 'users')) {
      try {
        await admin.collections.create({
          name: 'users',
          type: 'auth',
          listRule: 'id = @request.auth.id',
          viewRule: 'id = @request.auth.id',
          updateRule: 'id = @request.auth.id',
          deleteRule: 'id = @request.auth.id',
          manageRule: 'id = @request.auth.id',
          authRule: '',
          passwordAuth: { enabled: true, identityFields: ['email'] },
        });
      } catch (error) {
        const response = (error as { response?: unknown }).response;
        throw new Error(`Failed to create users collection: ${JSON.stringify(response)}`);
      }
    }

    await admin.collection('users').create({
      email: 'owner-one@example.test',
      password: USER_PASSWORD,
      passwordConfirm: USER_PASSWORD,
      verified: true,
    });
    await admin.collection('users').create({
      email: 'owner-two@example.test',
      password: USER_PASSWORD,
      passwordConfirm: USER_PASSWORD,
      verified: true,
    });

    const ownerOne = new PocketBase(baseUrl);
    const ownerTwo = new PocketBase(baseUrl);
    const ownerOneAuth = await ownerOne
      .collection('users')
      .authWithPassword('owner-one@example.test', USER_PASSWORD);
    const ownerTwoAuth = await ownerTwo
      .collection('users')
      .authWithPassword('owner-two@example.test', USER_PASSWORD);

    const ownerOneEvents: string[] = [];
    const ownerTwoEvents: string[] = [];
    const unsubscribeOne = await ownerOne.collection('tasks').subscribe('*', (event) => {
      ownerOneEvents.push(String(event.record.title));
    });
    const unsubscribeTwo = await ownerTwo.collection('tasks').subscribe('*', (event) => {
      ownerTwoEvents.push(String(event.record.title));
    });

    const plaintextMarker = `pt-${randomBytes(6).toString('hex')}`;
    clearPocketBase();
    const createResponse = await handleToolCall(
      'create_task',
      {
        title: plaintextMarker,
        description: `${plaintextMarker}-description`,
        urgent: false,
        important: true,
        tags: [`${plaintextMarker}-tag`],
      },
      { pocketBaseUrl: baseUrl, authToken: ownerOneAuth.token }
    );

    if (createResponse.isError) {
      throw new Error(`MCP create_task failed: ${createResponse.content[0]?.text ?? 'unknown'}`);
    }
    expect(createResponse.content[0]?.text).toContain(plaintextMarker);
    expect(await waitForValue(() => ownerOneEvents[0], 'owner-one realtime event')).toBe(
      plaintextMarker
    );

    const ownerOneList = await handleToolCall(
      'list_tasks',
      {},
      { pocketBaseUrl: baseUrl, authToken: ownerOneAuth.token }
    );
    expect(ownerOneList.isError).not.toBe(true);
    expect(JSON.parse(ownerOneList.content[0]?.text ?? 'null')).toHaveLength(1);

    const ownerOneRecords = await ownerOne.collection('tasks').getFullList();
    const ownerTwoRecords = await ownerTwo.collection('tasks').getFullList();
    expect(ownerOneRecords).toHaveLength(1);
    expect(ownerOneRecords[0]?.title).toBe(plaintextMarker);
    expect(ownerTwoRecords).toEqual([]);

    const ownerOneBulk = await handleToolCall(
      'bulk_update_tasks',
      {
        taskIds: [ownerOneRecords[0]!.task_id],
        operation: { type: 'complete', completed: true },
        dryRun: false,
      },
      { pocketBaseUrl: baseUrl, authToken: ownerOneAuth.token }
    );
    expect(ownerOneBulk.isError).not.toBe(true);
    expect((await ownerOne.collection('tasks').getOne(ownerOneRecords[0]!.id)).completed).toBe(true);

    const ownerTwoList = await handleToolCall(
      'list_tasks',
      {},
      { pocketBaseUrl: baseUrl, authToken: ownerTwoAuth.token }
    );
    expect(ownerTwoList.isError).not.toBe(true);
    expect(JSON.parse(ownerTwoList.content[0]?.text ?? 'null')).toEqual([]);

    const ownerTwoMarker = `owner-two-${randomBytes(6).toString('hex')}`;
    const ownerTwoCreate = await handleToolCall(
      'create_task',
      {
        title: ownerTwoMarker,
        urgent: true,
        important: false,
      },
      { pocketBaseUrl: baseUrl, authToken: ownerTwoAuth.token }
    );
    expect(ownerTwoCreate.isError).not.toBe(true);
    expect(await waitForValue(() => ownerTwoEvents[0], 'owner-two realtime control')).toBe(
      ownerTwoMarker
    );
    expect(ownerTwoEvents).not.toContain(plaintextMarker);
    expect(ownerOneEvents).not.toContain(ownerTwoMarker);

    const databaseBytes = readdirSync(dataDirectory)
      .filter((name) => name.startsWith('data.db'))
      .map((name) => readFileSync(join(dataDirectory, name)));
    expect(databaseBytes.length).toBeGreaterThan(0);
    expect(databaseBytes.some((bytes) => bytes.includes(Buffer.from('enc:v1:')))).toBe(true);
    expect(databaseBytes.some((bytes) => bytes.includes(Buffer.from(plaintextMarker)))).toBe(false);
    expect(databaseBytes.some((bytes) => bytes.includes(Buffer.from(ownerTwoMarker)))).toBe(false);

    unsubscribeOne();
    unsubscribeTwo();
  }, 30_000);

  it('proves browser push, pull, realtime isolation, token renewal, tombstones, and reconnect', async () => {
    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    let appProcess: ChildProcessWithoutNullStreams | undefined;
    let browser: Browser | undefined;
    let appOutput = '';

    try {
      const admin = new PocketBase(baseUrl);
      await admin.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
      const collections = await admin.collections.getFullList();
      if (!collections.some((collection) => collection.name === 'users')) {
        await admin.collections.create({
          name: 'users',
          type: 'auth',
          listRule: 'id = @request.auth.id',
          viewRule: 'id = @request.auth.id',
          updateRule: 'id = @request.auth.id',
          deleteRule: 'id = @request.auth.id',
          manageRule: 'id = @request.auth.id',
          authRule: '',
          passwordAuth: { enabled: true, identityFields: ['email'] },
        });
      }

      const suffix = randomBytes(5).toString('hex');
      const browserEmail = `browser-${suffix}@example.test`;
      const otherEmail = `other-${suffix}@example.test`;
      await admin.collection('users').create({
        email: browserEmail,
        password: USER_PASSWORD,
        passwordConfirm: USER_PASSWORD,
        verified: true,
      });
      const otherUser = await admin.collection('users').create({
        email: otherEmail,
        password: USER_PASSWORD,
        passwordConfirm: USER_PASSWORD,
        verified: true,
      });

      const browserClient = new PocketBase(baseUrl);
      const browserAuth = await browserClient
        .collection('users')
        .authWithPassword(browserEmail, USER_PASSWORD);

      const remotePullId = `remote-pull-${suffix}`;
      const remotePullTitle = `Remote pull ${suffix}`;
      await admin
        .collection('tasks')
        .create(remoteTask(browserAuth.record.id, remotePullId, remotePullTitle));

      const appPort = await availablePort();
      const appUrl = `http://127.0.0.1:${appPort}`;
      appProcess = spawn(
        'bun',
        [
          'run',
          'dev:e2e',
          '--',
          '--hostname',
          '127.0.0.1',
          '--port',
          String(appPort),
        ],
        {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            NEXT_PUBLIC_POCKETBASE_URL: baseUrl,
            NEXT_TELEMETRY_DISABLED: '1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      appProcess.stdout.on('data', (chunk) => {
        appOutput += chunk.toString();
      });
      appProcess.stderr.on('data', (chunk) => {
        appOutput += chunk.toString();
      });
      await waitForHttp(appUrl, appProcess, () => appOutput);

      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      await context.addInitScript(
        ({ token, record }) => {
          localStorage.setItem('gsd-onboarding-seen', 'true');
          localStorage.setItem('pocketbase_auth', JSON.stringify({ token, record }));
        },
        {
          token: browserAuth.token,
          record: JSON.parse(JSON.stringify(browserAuth.record)),
        }
      );
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('matrix-grid').waitFor({ state: 'visible', timeout: 30_000 });
      await seedBrowserSync(page, browserAuth.record.id, browserEmail);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('matrix-grid').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForFunction(() => {
        const label = document
          .querySelector('[data-testid="sync-button"]')
          ?.getAttribute('aria-label');
        return label && label !== 'Sync not enabled';
      });

      const browserPushTitle = `Browser push ${suffix}`;
      await page.getByTestId('capture-input').fill(browserPushTitle);
      await page.getByTestId('submit-task').click();
      await page
        .getByTestId('task-card')
        .filter({ hasText: browserPushTitle })
        .waitFor({ state: 'visible' });
      await clickBrowserSync(page);

      await waitForAsyncValue(
        async () => {
          try {
            const records = await admin
              .collection('tasks')
              .getFullList({ filter: `owner = "${browserAuth.record.id}"` });
            return records.find((record) => record.title === browserPushTitle);
          } catch {
            return undefined;
          }
        },
        'browser-created task in PocketBase'
      );
      await page
        .getByTestId('task-card')
        .filter({ hasText: remotePullTitle })
        .waitFor({ state: 'visible' });

      const usersCollection = await admin.collections.getOne('users');
      await admin.collections.update(usersCollection.id, {
        authToken: { ...usersCollection.authToken, duration: 120 },
      });
      const shortAuth = await browserClient
        .collection('users')
        .authWithPassword(browserEmail, USER_PASSWORD);
      const tokenBeforeRefresh = shortAuth.token;
      await page.evaluate(
        ({ token, record }) => {
          localStorage.setItem('pocketbase_auth', JSON.stringify({ token, record }));
        },
        {
          token: shortAuth.token,
          record: JSON.parse(JSON.stringify(shortAuth.record)),
        }
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('matrix-grid').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForFunction(() => {
        const label = document
          .querySelector('[data-testid="sync-button"]')
          ?.getAttribute('aria-label');
        return label && label !== 'Sync not enabled';
      });

      const renewalTitle = `Token renewal ${suffix}`;
      await page.getByTestId('capture-input').fill(renewalTitle);
      await page.getByTestId('submit-task').click();
      await clickBrowserSync(page);
      await waitForAsyncValue(
        async () => {
          try {
            const records = await admin
              .collection('tasks')
              .getFullList({ filter: `owner = "${browserAuth.record.id}"` });
            return records.find((record) => record.title === renewalTitle);
          } catch {
            return undefined;
          }
        },
        'post-renewal browser write'
      );
      const tokenAfterRefresh = await page.evaluate(() => {
        const auth = JSON.parse(localStorage.getItem('pocketbase_auth') ?? '{}') as {
          token?: string;
        };
        return auth.token ?? '';
      });
      expect(tokenAfterRefresh).not.toBe(tokenBeforeRefresh);

      const isolatedTitle = `Other owner ${suffix}`;
      await setBrowserAutoSync(page, false);
      // Allow SyncProvider's lifecycle poll to stop periodic auto-sync. Realtime
      // must remain subscribed because the provider, not the background manager,
      // owns SSE for the still-enabled cloud-sync session.
      await page.waitForTimeout(2_500);
      await admin
        .collection('tasks')
        .create(remoteTask(otherUser.id, `other-${suffix}`, isolatedTitle));
      await page.waitForTimeout(500);
      expect(
        await page.getByTestId('task-card').filter({ hasText: isolatedTitle }).count()
      ).toBe(0);

      const realtimeId = `realtime-${suffix}`;
      const realtimeTitle = `Realtime ${suffix}`;
      const realtimeRecord = await admin
        .collection('tasks')
        .create(remoteTask(browserAuth.record.id, realtimeId, realtimeTitle));
      await page
        .getByTestId('task-card')
        .filter({ hasText: realtimeTitle })
        .waitFor({ state: 'visible', timeout: 10_000 });

      const archivedAt = await archiveBrowserTask(page, realtimeId);
      // Native IndexedDB writes intentionally bypass Dexie's same-tab change
      // notifications; reload so the rendered matrix reflects the seeded
      // archive before exercising the real pull/realtime guards.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('matrix-grid').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForFunction(() => {
        const label = document
          .querySelector('[data-testid="sync-button"]')
          ?.getAttribute('aria-label');
        return label && label !== 'Sync not enabled';
      });
      await page
        .getByTestId('task-card')
        .filter({ hasText: realtimeTitle })
        .waitFor({ state: 'hidden' });
      await clickBrowserSync(page);
      await page.waitForTimeout(500);
      expect(
        await page.getByTestId('task-card').filter({ hasText: realtimeTitle }).count()
      ).toBe(0);

      const editedTitle = `Realtime edited ${suffix}`;
      const editedAt = new Date(new Date(archivedAt).getTime() + 1_000).toISOString();
      await admin.collection('tasks').update(realtimeRecord.id, {
        title: editedTitle,
        client_updated_at: editedAt,
        device_id: 'remote-edit-system',
      });
      await page
        .getByTestId('task-card')
        .filter({ hasText: editedTitle })
        .waitFor({ state: 'visible', timeout: 10_000 });

      const reconnectTitle = `Reconnect ${suffix}`;
      await context.setOffline(true);
      await admin
        .collection('tasks')
        .create(remoteTask(browserAuth.record.id, `reconnect-${suffix}`, reconnectTitle));
      await page.waitForTimeout(300);
      await context.setOffline(false);
      await page
        .getByTestId('task-card')
        .filter({ hasText: reconnectTitle })
        .waitFor({ state: 'visible', timeout: 15_000 });

      expect(pageErrors).toEqual([]);
      await context.close();
    } catch (error) {
      throw new Error(`${String(error)}\nApp output:\n${appOutput}`);
    } finally {
      await browser?.close();
      await stopProcess(appProcess);
    }
  }, 120_000);
});
