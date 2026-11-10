/**
 * A token PocketBase refuses, as after "Sign out of all devices" rotates the
 * token key, reads as a guest. The tasks rules then list an empty account and
 * 404 every record, so without a session check list_tasks answered [] and
 * update, complete, and delete answered "Task not found" (audit 2026-11-10,
 * P1 item 2: MCP-1). Runs the real tools, with only the SDK faked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GsdConfig } from '../types.js';

const server = vi.hoisted(() => ({
  /** The server refuses the configured token, so it reads every request as a guest's. */
  refused: false,
  records: [] as Array<Record<string, unknown>>,
  /** Requests in the order they arrived. */
  calls: [] as string[],
}));

vi.mock('pocketbase', () => {
  const refusal = () =>
    Object.assign(new Error('The request requires valid record authorization token.'), { status: 401 });
  const notFound = () => Object.assign(new Error("The requested resource wasn't found."), { status: 404 });

  class FakeAuthStore {
    token = '';
    record: { id: string; collectionName: string } | null = null;
    get isSuperuser(): boolean {
      return false;
    }
    save(token: string, record: { id: string; collectionName: string } | null): void {
      this.token = token;
      this.record = record;
    }
    clear(): void {
      this.token = '';
      this.record = null;
    }
  }

  class FakePocketBase {
    authStore = new FakeAuthStore();
    afterSend: unknown;
    health = { check: async () => ({ code: 200 }) };

    autoCancellation(): void {}

    /** PocketBase drops a token it refuses and answers as it answers a guest. */
    private isGuest(): boolean {
      return server.refused || !this.authStore.token;
    }

    private visible(filter?: string): Array<Record<string, unknown>> {
      if (this.isGuest()) return [];
      const ids = [...(filter ?? '').matchAll(/task_id = "([^"]+)"/g)].map((match) => match[1]);
      return server.records.filter((record) => ids.length === 0 || ids.includes(String(record.task_id)));
    }

    collection(name: string) {
      if (name === 'users') {
        return {
          authRefresh: async () => {
            server.calls.push('auth-refresh');
            if (this.isGuest()) throw refusal();
            this.authStore.save(this.authStore.token, { id: 'owner-1', collectionName: 'users' });
            return { token: this.authStore.token, record: this.authStore.record };
          },
        };
      }
      return {
        getFullList: async (options?: { filter?: string }) => {
          server.calls.push('list');
          return this.visible(options?.filter);
        },
        getList: async () => {
          server.calls.push('count');
          return { totalItems: this.visible().length, items: [] };
        },
        getFirstListItem: async (filter: string) => {
          server.calls.push('lookup');
          const [record] = this.visible(filter);
          if (!record) throw notFound();
          return record;
        },
        update: async () => {
          server.calls.push('update');
          if (this.isGuest()) throw notFound();
          return {};
        },
        delete: async () => {
          server.calls.push('delete');
          if (this.isGuest()) throw notFound();
          return true;
        },
      };
    }
  }

  return { default: FakePocketBase };
});

import { clearPocketBase, getPocketBase, requireUsersPrincipal } from '../pocketbase-client.js';
import { resetTaskCache } from '../cache.js';
import { listTasks } from '../tools/list-tasks.js';
import { getSyncStatus, getTaskStats } from '../tools/sync-status.js';
import { completeTask, deleteTask, updateTask } from '../write-ops/task-operations.js';
import { bulkUpdateTasks } from '../write-ops/bulk-operations.js';

const config: GsdConfig = { pocketBaseUrl: 'https://pb.example.invalid', authToken: 'configured-token' };
const SIGN_IN_ERROR = /Not authenticated as a normal users-collection account/;

function taskRecord(taskId: string) {
  return {
    id: `record-${taskId}`,
    task_id: taskId,
    owner: 'owner-1',
    title: `Task ${taskId}`,
    description: '',
    urgent: false,
    important: true,
    quadrant: 'not-urgent-important',
    completed: false,
    tags: [],
    subtasks: [],
    dependencies: [],
    recurrence: 'none',
    client_created_at: '2026-11-01T10:00:00.000Z',
    client_updated_at: '2026-11-01T10:00:00.000Z',
  };
}

/** "Sign out of all devices" elsewhere rotated the token key. */
function refuseToken(): void {
  server.refused = true;
}

beforeEach(() => {
  clearPocketBase();
  resetTaskCache();
  server.refused = false;
  server.records = [taskRecord('task-1')];
  server.calls = [];
});

describe('a token refused before its first use', () => {
  beforeEach(refuseToken);

  it('list_tasks asks the user to sign in again instead of listing an empty account', async () => {
    await expect(listTasks(config)).rejects.toThrow(SIGN_IN_ERROR);
  });

  it('update_task asks the user to sign in again instead of answering "Task not found"', async () => {
    await expect(updateTask(config, { id: 'task-1', title: 'Renamed' })).rejects.toThrow(SIGN_IN_ERROR);
  });

  it('complete_task asks the user to sign in again instead of answering "Task not found"', async () => {
    await expect(completeTask(config, 'task-1', true)).rejects.toThrow(SIGN_IN_ERROR);
  });

  it('delete_task asks the user to sign in again instead of answering "Task not found"', async () => {
    await expect(deleteTask(config, 'task-1', { dryRun: false })).rejects.toThrow(SIGN_IN_ERROR);
    await expect(deleteTask(config, 'task-1')).rejects.toThrow(SIGN_IN_ERROR);
    expect(server.calls).not.toContain('delete');
  });

  it('bulk_update_tasks asks the user to sign in again instead of finding no tasks', async () => {
    const complete = { type: 'complete', completed: true } as const;
    await expect(bulkUpdateTasks(config, ['task-1'], complete)).rejects.toThrow(SIGN_IN_ERROR);
    await expect(bulkUpdateTasks(config, ['task-1'], complete, { dryRun: true })).rejects.toThrow(SIGN_IN_ERROR);
  });

  it('get_task_stats reports unknown counts, not an empty account', async () => {
    await expect(getTaskStats(config)).resolves.toMatchObject({ totalTasks: null, activeTasks: null });
  });
});

describe('a token refused after it worked', () => {
  beforeEach(async () => {
    await requireUsersPrincipal(config);
    refuseToken();
  });

  it('list_tasks asks the user to sign in again', async () => {
    await expect(listTasks(config)).rejects.toThrow(SIGN_IN_ERROR);
  });

  it('update_task asks the user to sign in again', async () => {
    await expect(updateTask(config, { id: 'task-1', title: 'Renamed' })).rejects.toThrow(SIGN_IN_ERROR);
  });

  it('bulk_update_tasks asks the user to sign in again', async () => {
    await expect(bulkUpdateTasks(config, ['task-1'], { type: 'complete', completed: true })).rejects.toThrow(
      SIGN_IN_ERROR
    );
  });

  it('get_sync_status reports the server unhealthy, not an empty account', async () => {
    await expect(getSyncStatus(config)).resolves.toMatchObject({ healthy: false });
  });
});

describe('after a refusal', () => {
  it('the next call sends the configured token again, so it works once the server accepts it', async () => {
    refuseToken();
    await expect(requireUsersPrincipal(config)).rejects.toThrow(SIGN_IN_ERROR);

    server.refused = false;

    expect(getPocketBase(config).authStore.token).toBe(config.authToken);
    await expect(listTasks(config)).resolves.toHaveLength(1);
  });
});

describe('a token the server accepts', () => {
  it('lists an empty account as empty, after asking once', async () => {
    server.records = [];

    await expect(listTasks(config)).resolves.toEqual([]);
    expect(server.calls.filter((call) => call === 'auth-refresh')).toHaveLength(1);
  });

  it('asks nothing extra when the listing has tasks', async () => {
    await expect(listTasks(config)).resolves.toHaveLength(1);
    expect(server.calls).toEqual(['list']);
  });

  it('still answers "Task not found" for a task the account does not have', async () => {
    await expect(updateTask(config, { id: 'missing', title: 'Renamed' })).rejects.toThrow('Task not found: missing');
  });

  it('get_task_stats still counts an empty account as empty', async () => {
    server.records = [];

    await expect(getTaskStats(config)).resolves.toMatchObject({ totalTasks: 0, activeTasks: 0 });
  });
});
