/**
 * Shared test fixtures and utilities for GSD Task Manager tests
 * Provides mock data structures, factory functions, and common test helpers
 */

import { vi } from 'vitest';
import type {
  TaskRecord,
  TaskDraft,
  Subtask,
  NotificationSettings,
  SyncHistoryRecord,
} from '@/lib/types';
import type {
  PBSyncConfig,
  SyncQueueItem,
  PBSyncResult,
} from '@/lib/sync/types';
import type { HealthReport, HealthIssue } from '@/lib/sync/health-monitor';

// ============================================================================
// Task Fixtures
// ============================================================================

/**
 * Create a mock task with default values
 */
export function createMockTask(overrides?: Partial<TaskRecord>): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: 'test-task-1',
    title: 'Test Task',
    description: 'Test description',
    urgent: true,
    important: true,
    quadrant: 'urgent-important',
    completed: false,
    createdAt: now,
    updatedAt: now,
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: true,
    notificationSent: false,
    ...overrides,
  };
}

/**
 * Create a mock task draft for form input
 */
export function createMockTaskDraft(overrides?: Partial<TaskDraft>): TaskDraft {
  return {
    title: 'Test Task',
    description: 'Test description',
    urgent: true,
    important: true,
    recurrence: 'none',
    tags: [],
    subtasks: [],
    dependencies: [],
    notificationEnabled: true,
    ...overrides,
  };
}

/**
 * Create a mock subtask
 */
export function createMockSubtask(overrides?: Partial<Subtask>): Subtask {
  return {
    id: 'subtask-1',
    title: 'Test Subtask',
    completed: false,
    ...overrides,
  };
}

/**
 * Create multiple mock tasks
 */
export function createMockTasks(count: number, baseOverrides?: Partial<TaskRecord>): TaskRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTask({
      id: `test-task-${i + 1}`,
      title: `Test Task ${i + 1}`,
      ...baseOverrides,
    })
  );
}

// ============================================================================
// Sync Fixtures
// ============================================================================

/**
 * Create a mock PocketBase sync configuration
 */
export function createMockSyncConfig(overrides?: Partial<PBSyncConfig>): PBSyncConfig {
  return {
    key: 'sync_config',
    enabled: true,
    userId: 'user-123',
    deviceId: 'device-456',
    deviceName: 'Test Device',
    email: 'test@example.com',
    provider: 'google',
    lastSyncAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureReason: null,
    nextRetryAt: null,
    ...overrides,
  };
}

/**
 * Create a mock sync queue item
 */
export function createMockSyncQueueItem(overrides?: Partial<SyncQueueItem>): SyncQueueItem {
  return {
    id: 'queue-item-1',
    taskId: 'test-task-1',
    operation: 'create',
    timestamp: Date.now(),
    retryCount: 0,
    payload: createMockTask(),
    ...overrides,
  };
}

/**
 * Create a mock sync result
 */
export function createMockSyncResult(overrides?: Partial<PBSyncResult>): PBSyncResult {
  return {
    status: 'success',
    pushedCount: 0,
    pulledCount: 0,
    ...overrides,
  };
}

// ============================================================================
// Health Monitor Fixtures
// ============================================================================

/**
 * Create a mock health issue
 */
export function createMockHealthIssue(overrides?: Partial<HealthIssue>): HealthIssue {
  return {
    type: 'stale_queue',
    severity: 'warning',
    message: 'Test health issue',
    suggestedAction: 'Test action',
    ...overrides,
  };
}

/**
 * Create a mock health report
 */
export function createMockHealthReport(overrides?: Partial<HealthReport>): HealthReport {
  return {
    healthy: true,
    issues: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// Notification Fixtures
// ============================================================================

/**
 * Create mock notification settings
 */
export function createMockNotificationSettings(
  overrides?: Partial<NotificationSettings>
): NotificationSettings {
  return {
    id: 'settings',
    enabled: true,
    defaultReminder: 15,
    soundEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    permissionAsked: false,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Sync History Fixtures
// ============================================================================

/**
 * Create a mock sync history record
 */
export function createMockSyncHistoryRecord(
  overrides?: Partial<SyncHistoryRecord>
): SyncHistoryRecord {
  return {
    id: 'sync-history-1',
    timestamp: new Date().toISOString(),
    status: 'success',
    pushedCount: 0,
    pulledCount: 0,
    conflictsResolved: 0,
    deviceId: 'device-456',
    triggeredBy: 'user',
    ...overrides,
  };
}

// ============================================================================
// Mock API Response Factories
// ============================================================================

/**
 * Create a mock fetch Response object
 */
export function createMockFetchResponse(
  data: unknown,
  options?: { ok?: boolean; status?: number; statusText?: string }
): Response {
  return {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    statusText: options?.statusText ?? 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: function() { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as Response;
}

/**
 * Create a mock error Response object
 */
export function createMockErrorResponse(
  status: number,
  message: string
): Response {
  return createMockFetchResponse(
    { error: message },
    { ok: false, status, statusText: message }
  );
}

// ============================================================================
// Database Mock Factories
// ============================================================================

/**
 * Create a mock Dexie table with common methods.
 * Constrained to types with a string `id` field for type-safe lookups.
 */
export function createMockDexieTable<T extends { id: string }>() {
  const data: T[] = [];

  return {
    toArray: vi.fn(async () => [...data]),
    get: vi.fn(async (id: string) => data.find((item) => item.id === id)),
    add: vi.fn(async (item: T) => {
      data.push(item);
      return item.id;
    }),
    put: vi.fn(async (item: T) => {
      const index = data.findIndex((d) => d.id === item.id);
      if (index >= 0) {
        data[index] = item;
      } else {
        data.push(item);
      }
      return item.id;
    }),
    update: vi.fn(async (id: string, changes: Partial<T>) => {
      const index = data.findIndex((item) => item.id === id);
      if (index >= 0) {
        data[index] = { ...data[index], ...changes };
        return 1;
      }
      return 0;
    }),
    delete: vi.fn(async (id: string) => {
      const index = data.findIndex((item) => item.id === id);
      if (index >= 0) {
        data.splice(index, 1);
      }
    }),
    clear: vi.fn(async () => {
      data.length = 0;
    }),
    count: vi.fn(async () => data.length),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(async () => [...data]),
      })),
      anyOf: vi.fn(() => ({
        toArray: vi.fn(async () => [...data]),
      })),
    })),
    // Expose data for test assertions
    _data: data,
  };
}

// ============================================================================
// Test Utility Functions
// ============================================================================

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a date in the past
 */
export function createPastDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Create a date in the future
 */
export function createFutureDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

/**
 * Create an ISO string for a date relative to now
 */
export function createRelativeDateISO(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

/**
 * Mock console methods to suppress output during tests
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
  console.info = vi.fn();

  return {
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    },
  };
}

/**
 * Mock Date.now() for time-based tests
 */
export function mockDateNow(timestamp: number) {
  const original = Date.now;
  Date.now = vi.fn(() => timestamp);

  return {
    restore: () => {
      Date.now = original;
    },
  };
}

/**
 * Mock fetch for API tests
 */
export function mockFetch(response: Response | ((url: string, init?: RequestInit) => Response)) {
  const original = global.fetch;

  if (typeof response === 'function') {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      return response(input.toString(), init);
    }) as typeof fetch;
  } else {
    global.fetch = vi.fn(async () => response) as typeof fetch;
  }

  return {
    restore: () => {
      global.fetch = original;
    },
  };
}

/**
 * Assert that a promise rejects with a specific error message
 */
export async function expectToReject(
  promise: Promise<unknown>,
  expectedMessage?: string
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject, but it resolved');
  } catch (error) {
    if (expectedMessage && error instanceof Error) {
      expect(error.message).toContain(expectedMessage);
    }
  }
}
