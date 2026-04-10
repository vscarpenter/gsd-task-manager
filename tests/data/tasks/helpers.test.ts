import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set up mocks before imports
const mockBgSync = {
  isRunning: vi.fn(),
  scheduleDebouncedSync: vi.fn(),
};
const mockQueue = { enqueue: vi.fn() };

vi.mock('@/lib/sync/background-sync', () => ({
  getBackgroundSyncManager: vi.fn(() => mockBgSync),
}));

vi.mock('@/lib/sync/config', () => ({
  getSyncConfig: vi.fn(),
}));

vi.mock('@/lib/sync/queue', () => ({
  getSyncQueue: vi.fn(() => mockQueue),
}));

import {
  scheduleSyncAfterChange,
  getSyncContext,
  enqueueSyncOperation,
} from '@/lib/tasks/crud/helpers';
import { getSyncConfig } from '@/lib/sync/config';
import type { TaskRecord } from '@/lib/types';

describe('scheduleSyncAfterChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls scheduleDebouncedSync when sync manager is running', () => {
    mockBgSync.isRunning.mockReturnValue(true);

    scheduleSyncAfterChange();

    expect(mockBgSync.isRunning).toHaveBeenCalledOnce();
    expect(mockBgSync.scheduleDebouncedSync).toHaveBeenCalledOnce();
  });

  it('does nothing when sync manager is not running', () => {
    mockBgSync.isRunning.mockReturnValue(false);

    scheduleSyncAfterChange();

    expect(mockBgSync.isRunning).toHaveBeenCalledOnce();
    expect(mockBgSync.scheduleDebouncedSync).not.toHaveBeenCalled();
  });
});

describe('getSyncContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sync config and deviceId from config', async () => {
    const mockConfig = { enabled: true, deviceId: 'device-abc' };
    (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfig);

    const result = await getSyncContext();

    expect(result.syncConfig).toEqual(mockConfig);
    expect(result.deviceId).toBe('device-abc');
  });

  it('uses "local" as deviceId when config has no deviceId', async () => {
    const mockConfig = { enabled: false, deviceId: '' };
    (getSyncConfig as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfig);

    const result = await getSyncContext();

    expect(result.deviceId).toBe('local');
  });
});

describe('enqueueSyncOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBgSync.isRunning.mockReturnValue(true);
  });

  const mockTask = {
    id: 'task-1',
    title: 'Test',
  } as TaskRecord;

  it('skips enqueue when sync is disabled', async () => {
    await enqueueSyncOperation('create', 'task-1', mockTask, false);

    expect(mockQueue.enqueue).not.toHaveBeenCalled();
    expect(mockBgSync.scheduleDebouncedSync).not.toHaveBeenCalled();
  });

  it('enqueues operation and triggers sync when enabled', async () => {
    mockQueue.enqueue.mockResolvedValue(undefined);

    await enqueueSyncOperation('update', 'task-1', mockTask, true);

    expect(mockQueue.enqueue).toHaveBeenCalledWith('update', 'task-1', mockTask);
    expect(mockBgSync.isRunning).toHaveBeenCalled();
    expect(mockBgSync.scheduleDebouncedSync).toHaveBeenCalledOnce();
  });
});
