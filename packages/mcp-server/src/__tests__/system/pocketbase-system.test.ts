import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { EventSource } from 'eventsource';
import PocketBase from 'pocketbase';
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
});
