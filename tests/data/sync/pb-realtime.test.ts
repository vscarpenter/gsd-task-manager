/**
 * Tests for lib/sync/pb-realtime.ts
 * Covers subscribe, unsubscribe, and realtime event handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const {
  mockGetPocketBase,
  mockGetCurrentUserId,
  mockApplyRemoteChange,
  mockSubscribe,
  mockUnsubscribeFn,
} = vi.hoisted(() => {
  const mockUnsubscribeFn = vi.fn();
  return {
    mockGetPocketBase: vi.fn(),
    mockGetCurrentUserId: vi.fn(),
    mockApplyRemoteChange: vi.fn().mockResolvedValue(undefined),
    mockSubscribe: vi.fn().mockResolvedValue(mockUnsubscribeFn),
    mockUnsubscribeFn,
  };
});

vi.mock('@/lib/sync/pocketbase-client', () => ({
  getPocketBase: () => mockGetPocketBase(),
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

vi.mock('@/lib/sync/pb-sync-engine', () => ({
  applyRemoteChange: (...args: unknown[]) => mockApplyRemoteChange(...args),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Must import after mocks
import { subscribe, unsubscribe } from '@/lib/sync/pb-realtime';

describe('pb-realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state by unsubscribing
    unsubscribe();

    mockGetPocketBase.mockReturnValue({
      collection: () => ({ subscribe: mockSubscribe }),
    });
    mockGetCurrentUserId.mockReturnValue('user-123');
  });

  describe('subscribe', () => {
    it('should not subscribe when not authenticated', async () => {
      mockGetCurrentUserId.mockReturnValue(null);

      await subscribe('device-1');

      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('should subscribe to tasks collection when authenticated', async () => {
      await subscribe('device-1');

      expect(mockSubscribe).toHaveBeenCalledWith('*', expect.any(Function));
    });

    it('should unsubscribe existing subscription before creating new one', async () => {
      await subscribe('device-1');
      await subscribe('device-2');

      // First subscription's unsubscribe should have been called
      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should call unsubscribe function when subscribed', async () => {
      await subscribe('device-1');
      unsubscribe();

      expect(mockUnsubscribeFn).toHaveBeenCalled();
    });

    it('should be safe to call when not subscribed', () => {
      // Should not throw
      unsubscribe();
      expect(true).toBe(true);
    });
  });

  describe('handleRealtimeEvent', () => {
    it('should skip echo events from the same device', async () => {
      await subscribe('device-1');

      // Get the handler that was passed to subscribe
      const handler = mockSubscribe.mock.calls[0][1];

      await handler({
        action: 'update',
        record: {
          device_id: 'device-1',
          owner: 'user-123',
          task_id: 'task-1',
        },
      });

      expect(mockApplyRemoteChange).not.toHaveBeenCalled();
    });

    it('should skip events from other users', async () => {
      await subscribe('device-1');

      const handler = mockSubscribe.mock.calls[0][1];

      await handler({
        action: 'update',
        record: {
          device_id: 'device-2',
          owner: 'other-user',
          task_id: 'task-1',
        },
      });

      expect(mockApplyRemoteChange).not.toHaveBeenCalled();
    });

    it('should apply remote changes for valid events', async () => {
      await subscribe('device-1');

      const handler = mockSubscribe.mock.calls[0][1];

      const record = {
        device_id: 'device-2',
        owner: 'user-123',
        task_id: 'task-1',
      };

      await handler({ action: 'create', record });

      expect(mockApplyRemoteChange).toHaveBeenCalledWith('create', record);
    });
  });
});
