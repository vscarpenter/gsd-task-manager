import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import PocketBase from 'pocketbase';
import { afterAll, describe, expect, it } from 'vitest';

const CURRENT_BIN = process.env.POCKETBASE_BIN;
const UPGRADE_SOURCE_BIN = process.env.POCKETBASE_OLD_BIN;
const describeUpgrade = CURRENT_BIN && UPGRADE_SOURCE_BIN ? describe : describe.skip;
const REPO_ROOT = resolve(import.meta.dirname, '../../../../..');
const ADMIN_EMAIL = 'upgrade-admin@example.test';
const ADMIN_PASSWORD = 'upgrade-admin-password-1234';

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

async function waitForHealth(
  baseUrl: string,
  child: ChildProcessWithoutNullStreams,
  readOutput: () => string
): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`PocketBase exited with ${child.exitCode}:\n${readOutput()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Listener is still starting.
    }
    await delay(100);
  }
  throw new Error(`PocketBase readiness timed out:\n${readOutput()}`);
}

async function stopPocketBase(child: ChildProcessWithoutNullStreams | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const deadline = Date.now() + 5_000;
  while (child.exitCode === null && Date.now() < deadline) await delay(25);
  if (child.exitCode === null) child.kill('SIGKILL');
}

describeUpgrade('PocketBase existing-data upgrade boundary', () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), 'gsd-pocketbase-upgrade-'));
  const legacyMigrationDirectory = mkdtempSync(join(tmpdir(), 'gsd-pocketbase-legacy-migration-'));
  let pocketBaseProcess: ChildProcessWithoutNullStreams | undefined;

  afterAll(async () => {
    await stopPocketBase(pocketBaseProcess);
    rmSync(dataDirectory, { recursive: true, force: true });
    rmSync(legacyMigrationDirectory, { recursive: true, force: true });
  });

  it('repairs an already-applied legacy migration while preserving identity and timestamps', async () => {
    execFileSync(
      UPGRADE_SOURCE_BIN!,
      ['superuser', 'upsert', ADMIN_EMAIL, ADMIN_PASSWORD, `--dir=${dataDirectory}`],
      { cwd: REPO_ROOT, stdio: 'pipe' }
    );

    const oldPort = await availablePort();
    const oldUrl = `http://127.0.0.1:${oldPort}`;
    let oldOutput = '';
    pocketBaseProcess = spawn(
      UPGRADE_SOURCE_BIN!,
      [
        'serve',
        `--dir=${dataDirectory}`,
        '--automigrate=false',
        `--migrationsDir=${join(dataDirectory, 'source-migrations')}`,
        `--http=127.0.0.1:${oldPort}`,
      ],
      { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    pocketBaseProcess.stdout.on('data', (chunk) => { oldOutput += chunk.toString(); });
    pocketBaseProcess.stderr.on('data', (chunk) => { oldOutput += chunk.toString(); });
    await waitForHealth(oldUrl, pocketBaseProcess, () => oldOutput);

    const oldAdmin = new PocketBase(oldUrl);
    await oldAdmin.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    const initialCollections = await oldAdmin.collections.getFullList();
    if (!initialCollections.some((collection) => collection.name === 'tasks')) {
      try {
        execFileSync('bash', ['scripts/setup-pocketbase-collections.sh'], {
          cwd: REPO_ROOT,
          env: {
            ...process.env,
            PB_URL: oldUrl,
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

    const marker = `upgrade-${randomBytes(6).toString('hex')}`;
    const seeded = await oldAdmin.collection('tasks').create({
      task_id: 'upgrade-task-fixture',
      owner: 'upgrade-owner-id',
      title: marker,
      description: `${marker}-description`,
      urgent: false,
      important: true,
      quadrant: 'not-urgent-important',
      completed: false,
      recurrence: 'none',
      tags: ['café', '計画', '🚀', marker],
      subtasks: [{ id: 'upgrade-subtask', title: `étape 計画 🚀 ${marker}`, completed: false }],
      time_entries: [{ start: '2026-08-05T10:00:00.000Z', end: '2026-08-05T10:30:00.000Z' }],
      client_created_at: '2026-07-01T12:00:00.000Z',
      client_updated_at: '2026-07-02T13:00:00.000Z',
      device_id: 'upgrade-fixture',
    });
    const preserved = {
      id: seeded.id,
      owner: seeded.owner,
      created: seeded.created,
      clientCreatedAt: seeded.client_created_at,
      clientUpdatedAt: seeded.client_updated_at,
    };

    await stopPocketBase(pocketBaseProcess);
    pocketBaseProcess = undefined;

    const encryptionKey = randomBytes(16).toString('hex');
    copyFileSync(
      resolve(REPO_ROOT, 'docker/pb_migrations/1781000000_encrypt_existing_tasks.js'),
      join(legacyMigrationDirectory, '1781000000_encrypt_existing_tasks.js')
    );
    execFileSync(
      CURRENT_BIN!,
      [
        'migrate',
        'up',
        `--dir=${dataDirectory}`,
        '--automigrate=false',
        `--hooksDir=${resolve(REPO_ROOT, 'docker/pb_hooks')}`,
        `--migrationsDir=${legacyMigrationDirectory}`,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, GSD_TASKS_ENC_KEY: encryptionKey },
        stdio: 'pipe',
      }
    );

    const legacyPort = await availablePort();
    const legacyUrl = `http://127.0.0.1:${legacyPort}`;
    let legacyOutput = '';
    pocketBaseProcess = spawn(
      CURRENT_BIN!,
      [
        'serve',
        `--dir=${dataDirectory}`,
        '--automigrate=false',
        `--hooksDir=${resolve(REPO_ROOT, 'docker/pb_hooks')}`,
        `--migrationsDir=${legacyMigrationDirectory}`,
        `--http=127.0.0.1:${legacyPort}`,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, GSD_TASKS_ENC_KEY: encryptionKey },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    pocketBaseProcess.stdout.on('data', (chunk) => { legacyOutput += chunk.toString(); });
    pocketBaseProcess.stderr.on('data', (chunk) => { legacyOutput += chunk.toString(); });
    await waitForHealth(legacyUrl, pocketBaseProcess, () => legacyOutput);
    const legacyAdmin = new PocketBase(legacyUrl);
    await legacyAdmin.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    const afterLegacyMigration = await legacyAdmin.collection('tasks').getOne(seeded.id);
    expect(afterLegacyMigration).toMatchObject({
      id: preserved.id,
      owner: preserved.owner,
      created: preserved.created,
      client_created_at: preserved.clientCreatedAt,
      client_updated_at: preserved.clientUpdatedAt,
    });
    await stopPocketBase(pocketBaseProcess);
    pocketBaseProcess = undefined;

    execFileSync(
      CURRENT_BIN!,
      [
        'migrate',
        'up',
        `--dir=${dataDirectory}`,
        '--automigrate=false',
        `--hooksDir=${resolve(REPO_ROOT, 'docker/pb_hooks')}`,
        `--migrationsDir=${resolve(REPO_ROOT, 'docker/pb_migrations')}`,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, GSD_TASKS_ENC_KEY: encryptionKey },
        stdio: 'pipe',
      }
    );

    const currentPort = await availablePort();
    const currentUrl = `http://127.0.0.1:${currentPort}`;
    let currentOutput = '';
    pocketBaseProcess = spawn(
      CURRENT_BIN!,
      [
        'serve',
        `--dir=${dataDirectory}`,
        '--automigrate=false',
        `--hooksDir=${resolve(REPO_ROOT, 'docker/pb_hooks')}`,
        `--migrationsDir=${resolve(REPO_ROOT, 'docker/pb_migrations')}`,
        `--http=127.0.0.1:${currentPort}`,
      ],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, GSD_TASKS_ENC_KEY: encryptionKey },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    pocketBaseProcess.stdout.on('data', (chunk) => { currentOutput += chunk.toString(); });
    pocketBaseProcess.stderr.on('data', (chunk) => { currentOutput += chunk.toString(); });
    await waitForHealth(currentUrl, pocketBaseProcess, () => currentOutput);
    expect(currentOutput).toContain('VACUUM');

    const currentAdmin = new PocketBase(currentUrl);
    await currentAdmin.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    const upgraded = await currentAdmin.collection('tasks').getOne(seeded.id);

    expect(upgraded).toMatchObject({
      id: preserved.id,
      owner: preserved.owner,
      created: afterLegacyMigration.created,
      updated: afterLegacyMigration.updated,
      client_created_at: preserved.clientCreatedAt,
      client_updated_at: preserved.clientUpdatedAt,
      title: marker,
      description: `${marker}-description`,
      tags: ['café', '計画', '🚀', marker],
      subtasks: [{ id: 'upgrade-subtask', title: `étape 計画 🚀 ${marker}`, completed: false }],
      time_entries: [{ start: '2026-08-05T10:00:00.000Z', end: '2026-08-05T10:30:00.000Z' }],
    });

    const databaseFiles = readdirSync(dataDirectory)
      .filter((name) => name.startsWith('data.db'))
      .map((name) => ({ name, bytes: readFileSync(join(dataDirectory, name)) }));
    expect(databaseFiles.some(({ bytes }) => bytes.includes(Buffer.from('enc:v1:')))).toBe(true);
    const plaintextRemnants = databaseFiles.flatMap(({ name, bytes }) => {
      const offset = bytes.indexOf(Buffer.from(marker));
      if (offset < 0) return [];
      return [{
        name,
        context: bytes.subarray(Math.max(0, offset - 80), offset + marker.length + 80).toString(),
      }];
    });
    expect(plaintextRemnants).toEqual([]);
  }, 45_000);
});
