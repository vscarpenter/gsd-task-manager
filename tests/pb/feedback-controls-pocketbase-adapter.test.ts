import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'docker/pb_hooks/feedback_controls.pb.js'),
  'utf8',
);

class TestInternalServerError extends Error {}
class TestTooManyRequestsError extends Error {}

function compliantSettings() {
  return {
    rateLimits: {
      enabled: true,
      rules: [
        {
          label: 'feedback:create',
          audience: '',
          maxRequests: 30,
          duration: 60,
        },
      ],
    },
    logs: {
      maxDays: 1,
      logIP: false,
      logAuthId: false,
    },
  };
}

function loadHooks(globalApp: Record<string, unknown> = {}) {
  let requestHandler: ((event: unknown) => void) | undefined;
  let executeHandler: ((event: unknown) => void) | undefined;
  let retentionHandler: (() => void) | undefined;
  let route:
    | {
        method: string;
        path: string;
        handler: (event: unknown) => unknown;
        middleware: unknown;
      }
    | undefined;
  const superuserMiddleware = Symbol('superuser-auth');

  vm.runInNewContext(source, {
    onRecordCreateRequest: (handler: (event: unknown) => void, collection: string) => {
      expect(collection).toBe('feedback');
      requestHandler = handler;
    },
    onRecordCreateExecute: (handler: (event: unknown) => void, collection: string) => {
      expect(collection).toBe('feedback');
      executeHandler = handler;
    },
    cronAdd: (id: string, schedule: string, handler: () => void) => {
      expect(id).toBe('gsd-feedback-retention');
      expect(schedule).toBe('17 3 * * *');
      retentionHandler = handler;
    },
    routerAdd: (
      method: string,
      path: string,
      handler: (event: unknown) => unknown,
      middleware: unknown,
    ) => {
      route = { method, path, handler, middleware };
    },
    $apis: {
      requireSuperuserAuth: () => superuserMiddleware,
    },
    $app: globalApp,
    InternalServerError: TestInternalServerError,
    TooManyRequestsError: TestTooManyRequestsError,
  });

  return {
    requestHandler: () => requestHandler!,
    executeHandler: () => executeHandler!,
    retentionHandler: () => retentionHandler!,
    route: () => route!,
    superuserMiddleware,
  };
}

describe('PocketBase anonymous feedback controls', () => {
  it('allows creation only while the checked-in rate and log policy is active', () => {
    const hooks = loadHooks();
    const next = vi.fn();

    hooks.requestHandler()({
      app: { settings: () => compliantSettings() },
      next,
    });
    expect(next).toHaveBeenCalledTimes(1);

    const unsafeSettings = [
      { ...compliantSettings(), rateLimits: { ...compliantSettings().rateLimits, enabled: false } },
      {
        ...compliantSettings(),
        rateLimits: {
          enabled: true,
          rules: [
            { label: 'feedback:create', audience: '@guest', maxRequests: 30, duration: 60 },
          ],
        },
      },
      { ...compliantSettings(), logs: { maxDays: 30, logIP: false, logAuthId: false } },
      { ...compliantSettings(), logs: { maxDays: 1, logIP: true, logAuthId: false } },
    ];

    for (const settings of unsafeSettings) {
      expect(() =>
        hooks.requestHandler()({
          app: { settings: () => settings },
          next: vi.fn(),
        }),
      ).toThrow(TestInternalServerError);
    }
  });

  it('checks and inserts under one transaction so concurrent creates cannot exceed quota', () => {
    const hooks = loadHooks();
    const txApp = {
      settings: () => compliantSettings(),
      countRecords: vi.fn(() => 9999),
    };
    const originalApp = {
      runInTransaction: vi.fn((callback: (app: typeof txApp) => void) => callback(txApp)),
    };
    const event = {
      app: originalApp,
      next: vi.fn(() => {
        expect(event.app).toBe(txApp);
      }),
    };

    hooks.executeHandler()(event);

    expect(txApp.countRecords).toHaveBeenCalledWith('feedback');
    expect(event.next).toHaveBeenCalledTimes(1);
    expect(event.app).toBe(originalApp);
  });

  it('rejects aggregate-quota overflow without executing the insert', () => {
    const hooks = loadHooks();
    const txApp = {
      settings: () => compliantSettings(),
      countRecords: vi.fn(() => 10000),
    };
    const originalApp = {
      runInTransaction: (callback: (app: typeof txApp) => void) => callback(txApp),
    };
    const event = { app: originalApp, next: vi.fn() };

    expect(() => hooks.executeHandler()(event)).toThrow(TestTooManyRequestsError);
    expect(event.next).not.toHaveBeenCalled();
    expect(event.app).toBe(originalApp);
  });

  it('deletes expired records in bounded zero-offset batches', () => {
    const expired = [{ id: 'one' }, { id: 'two' }];
    const txApp = {
      findRecordsByFilter: vi.fn().mockReturnValueOnce(expired).mockReturnValueOnce([]),
      delete: vi.fn(),
    };
    const globalApp = {
      runInTransaction: (callback: (app: typeof txApp) => void) => callback(txApp),
    };
    const hooks = loadHooks(globalApp);

    hooks.retentionHandler()();

    expect(txApp.findRecordsByFilter).toHaveBeenCalledWith(
      'feedback',
      'created < {:cutoff}',
      'created',
      250,
      0,
      expect.objectContaining({ cutoff: expect.stringMatching(/Z$/) }),
    );
    expect(txApp.delete).toHaveBeenCalledTimes(2);
  });

  it('exposes a superuser-only readiness marker for setup verification', () => {
    const hooks = loadHooks();
    const json = vi.fn((_status: number, body: unknown) => body);
    const result = hooks.route().handler({
      app: {
        settings: () => compliantSettings(),
        countRecords: () => 42,
      },
      json,
    });

    expect(hooks.route()).toMatchObject({
      method: 'GET',
      path: '/api/gsd/feedback-controls',
      middleware: hooks.superuserMiddleware,
    });
    expect(result).toMatchObject({
      hookVersion: 1,
      ready: true,
      accepting: true,
      quotaLimit: 10000,
      recordCount: 42,
      retentionDays: 180,
    });
    expect(json).toHaveBeenCalledWith(200, expect.any(Object));
  });
});
