import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'docker/pb_hooks/account_lifecycle.pb.js'),
  'utf8',
);

function loadHooks() {
  let route:
    | { method: string; path: string; handler: (event: unknown) => unknown; middleware: unknown }
    | undefined;
  let createHandler: ((event: unknown) => void) | undefined;
  const authMiddleware = Symbol('users-auth');

  vm.runInNewContext(source, {
    routerAdd: (method: string, path: string, handler: (event: unknown) => unknown, middleware: unknown) => {
      route = { method, path, handler, middleware };
    },
    onRecordCreateExecute: (handler: (event: unknown) => void, collection: string) => {
      expect(collection).toBe('tasks');
      createHandler = handler;
    },
    $apis: {
      requireAuth: (collection: string) => {
        expect(collection).toBe('users');
        return authMiddleware;
      },
    },
  });

  return {
    route: () => route!,
    createHandler: () => createHandler!,
    authMiddleware,
  };
}

describe('PocketBase account lifecycle hooks', () => {
  it('deletes every owned task before the user in one transaction', () => {
    const hooks = loadHooks();
    const order: string[] = [];
    const tasks = [{ id: 'task-a' }, { id: 'task-b' }];
    const user = { id: 'user-1' };
    const txApp = {
      findRecordById: vi.fn(() => user),
      findRecordsByFilter: vi.fn()
        .mockReturnValueOnce(tasks)
        .mockReturnValueOnce([]),
      delete: vi.fn((record: { id: string }) => order.push(record.id)),
    };
    const noContent = vi.fn(() => 'done');
    const event = {
      auth: user,
      app: {
        runInTransaction: (callback: (app: typeof txApp) => void) => callback(txApp),
      },
      noContent,
    };

    expect(hooks.route()).toMatchObject({
      method: 'DELETE',
      path: '/api/gsd/account',
      middleware: hooks.authMiddleware,
    });
    expect(hooks.route().handler(event)).toBe('done');
    expect(order).toEqual(['task-a', 'task-b', 'user-1']);
    expect(txApp.findRecordsByFilter).toHaveBeenCalledWith(
      'tasks', 'owner = {:owner}', '', 100, 0, { owner: 'user-1' },
    );
    expect(noContent).toHaveBeenCalledWith(204);
  });

  it('rechecks owner existence in the same transaction as task insertion', () => {
    const hooks = loadHooks();
    const txApp = {
      findRecordById: vi.fn(),
    };
    const originalApp = {
      runInTransaction: vi.fn((callback: (app: typeof txApp) => void) => callback(txApp)),
    };
    const event = {
      app: originalApp,
      record: { getString: vi.fn(() => 'user-1') },
      next: vi.fn(() => {
        expect(event.app).toBe(txApp);
      }),
    };

    hooks.createHandler()(event);

    expect(txApp.findRecordById).toHaveBeenCalledWith('users', 'user-1');
    expect(event.next).toHaveBeenCalledTimes(1);
    expect(event.app).toBe(originalApp);
  });
});
