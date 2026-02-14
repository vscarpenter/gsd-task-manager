import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { SyncApiClient, getApiClient, clearApiClient } from '@/lib/sync/api-client';
import {
  SyncNetworkError,
  SyncAuthError,
  SyncValidationError,
} from '@/lib/sync/errors';

describe('SyncApiClient', () => {
  let client: SyncApiClient;
  const baseUrl = 'https://test-api.example.com';
  const testToken = 'test-token-123';

  beforeEach(() => {
    client = new SyncApiClient(baseUrl);
    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearApiClient();
  });

  describe('Constructor', () => {
    it('should initialize with base URL', () => {
      expect(client).toBeInstanceOf(SyncApiClient);
    });

    it('should remove trailing slash from base URL', () => {
      const clientWithSlash = new SyncApiClient('https://api.example.com/');
      expect(clientWithSlash).toBeInstanceOf(SyncApiClient);
    });
  });

  describe('Token Management', () => {
    it('should set authentication token', () => {
      client.setToken(testToken);
      // Token is set internally (can't directly test, but verify no errors)
      expect(() => client.setToken(testToken)).not.toThrow();
    });

    it('should clear authentication token', () => {
      client.setToken(testToken);
      client.setToken(null);
      expect(() => client.setToken(null)).not.toThrow();
    });
  });

  describe('Authentication Endpoints', () => {
    describe('logout()', () => {
      beforeEach(() => {
        client.setToken(testToken);
      });

      it('should make POST request to /api/auth/logout with auth', async () => {
        const mockResponse = { success: true };

        (global.fetch as unknown as Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.logout();

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${baseUrl}/api/auth/logout`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          })
        );
      });
    });

    describe('refreshToken()', () => {
      beforeEach(() => {
        client.setToken(testToken);
      });

      it('should make POST request to /api/auth/refresh with auth', async () => {
        const mockResponse = {
          token: 'refreshed-token',
          expiresAt: Date.now() + 86400000,
        };

        (global.fetch as unknown as Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.refreshToken();

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${baseUrl}/api/auth/refresh`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          })
        );
      });
    });
  });

  describe('Sync Endpoints', () => {
    beforeEach(() => {
      client.setToken(testToken);
    });

    describe('push()', () => {
      it('should make POST request to /api/sync/push with auth', async () => {
        const mockResponse = {
          accepted: ['task-1', 'task-2'],
          rejected: [],
          conflicts: [],
        };

        (global.fetch as unknown as Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.push({
          operations: [
            {
              type: 'create',
              taskId: 'task-1',
              encryptedBlob: 'encrypted-data',
              nonce: 'test-nonce',
              vectorClock: {},
              checksum: 'test-checksum',
            },
          ],
          deviceId: 'device-123',
          clientVectorClock: {},
        });

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${baseUrl}/api/sync/push`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          })
        );
      });

      it('should throw SyncAuthError on 401 error', async () => {
        (global.fetch as unknown as Mock).mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ error: 'Token expired' }),
        });

        await expect(
          client.push({
            operations: [],
            deviceId: 'device-123',
            clientVectorClock: {},
          })
        ).rejects.toThrow(SyncAuthError);
      });
    });

    describe('pull()', () => {
      it('should make POST request to /api/sync/pull with auth', async () => {
        const mockResponse = {
          tasks: [
            {
              id: 'task-1',
              data: { title: 'Synced Task' },
              vectorClock: {},
            },
          ],
          deletedTaskIds: [],
          syncTimestamp: Date.now(),
        };

        (global.fetch as unknown as Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.pull({
          deviceId: 'device-123',
          lastVectorClock: {},
        });

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${baseUrl}/api/sync/pull`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          })
        );
      });
    });

    describe('getStatus()', () => {
      it('should make GET request to /api/sync/status with auth', async () => {
        const mockResponse = {
          userId: 'user-123',
          deviceCount: 2,
          lastSyncAt: Date.now(),
          storageUsed: 1024,
        };

        (global.fetch as unknown as Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.getStatus();

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${baseUrl}/api/sync/status`,
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          })
        );
      });
    });
  });

  describe('Device Management Endpoints', () => {
    beforeEach(() => {
      client.setToken(testToken);
    });

    describe('listDevices()', () => {
      it('should make GET request to /api/devices with auth', async () => {
        const mockResponse = {
          devices: [
            {
              id: 'device-1',
              name: 'Device 1',
              lastSeen: Date.now(),
            },
            {
              id: 'device-2',
              name: 'Device 2',
              lastSeen: Date.now(),
            },
          ],
        };

        (global.fetch as unknown as Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.listDevices();

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${baseUrl}/api/devices`,
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          })
        );
      });
    });

    describe('revokeDevice()', () => {
      it('should make DELETE request to /api/devices/:deviceId with auth', async () => {
        const mockResponse = { success: true };

        (global.fetch as unknown as Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await client.revokeDevice('device-123');

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${baseUrl}/api/devices/device-123`,
          expect.objectContaining({
            method: 'DELETE',
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should categorize 401 as SyncAuthError', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Authentication failed' }),
      });

      await expect(client.listDevices()).rejects.toThrow(SyncAuthError);
    });

    it('should categorize 403 as SyncAuthError', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Access denied' }),
      });

      await expect(client.listDevices()).rejects.toThrow(SyncAuthError);
    });

    it('should categorize 500 as SyncNetworkError', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      await expect(client.listDevices()).rejects.toThrow(SyncNetworkError);
    });

    it('should categorize 503 as SyncNetworkError', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: 'Service unavailable' }),
      });

      await expect(client.listDevices()).rejects.toThrow(SyncNetworkError);
    });

    it('should categorize 400 as SyncValidationError', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid request' }),
      });

      await expect(client.listDevices()).rejects.toThrow(SyncValidationError);
    });

    it('should categorize 422 as SyncValidationError', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({ error: 'Validation failed' }),
      });

      await expect(client.listDevices()).rejects.toThrow(SyncValidationError);
    });

    it('should handle network errors (fetch throws)', async () => {
      (global.fetch as unknown as Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.listDevices()).rejects.toThrow(SyncNetworkError);
    });

    it('should handle invalid JSON response', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(client.listDevices()).rejects.toThrow(SyncNetworkError);
    });

    it('should preserve error context', async () => {
      const errorMessage = 'Custom error message';
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: errorMessage }),
      });

      try {
        await client.listDevices();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SyncAuthError);
        expect((error as SyncAuthError).message).toContain(errorMessage);
        expect((error as SyncAuthError).statusCode).toBe(401);
      }
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getApiClient', () => {
      const instance1 = getApiClient(baseUrl);
      const instance2 = getApiClient();

      expect(instance1).toBe(instance2);
    });

    it('should clear singleton instance', () => {
      const instance1 = getApiClient(baseUrl);
      clearApiClient();

      const instance2 = getApiClient(baseUrl);
      expect(instance1).not.toBe(instance2);
    });

    it('should throw error when creating without server URL on first call', () => {
      clearApiClient();

      expect(() => getApiClient()).toThrow('Server URL required');
    });
  });

  describe('Request Headers', () => {
    beforeEach(() => {
      client.setToken(testToken);
    });

    it('should include Content-Type header', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.push({
        operations: [
          {
            type: 'create',
            taskId: 'task-1',
            encryptedBlob: 'encrypted-data',
            nonce: 'test-nonce',
            vectorClock: {},
            checksum: 'test-checksum',
          },
        ],
        deviceId: 'device-123',
        clientVectorClock: {},
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should include Authorization header when token is set and auth is required', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.logout();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${testToken}`,
          }),
        })
      );
    });

    it('should omit Authorization header when token is missing', async () => {
      (global.fetch as unknown as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      client.setToken(null);

      await client.listDevices();

      const callArgs = (global.fetch as unknown as Mock).mock.calls[0][1];
      expect(callArgs.headers.Authorization).toBeUndefined();
    });
  });
});
