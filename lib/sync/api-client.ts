/**
 * API client for Cloudflare Worker sync backend
 */

import { createLogger } from '@/lib/logger';
import {
  SyncNetworkError,
  SyncAuthError,
  SyncValidationError,
} from './errors';
import type {
  PushRequest,
  PushResponse,
  PullRequest,
  PullResponse,
  SyncStatusResponse,
  DeviceInfo,
} from './types';

const logger = createLogger('SYNC_API');

export class SyncApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Set authentication token
   */
  setToken(token: string | null): void {
    this.token = token;
  }

  /**
   * Get authentication headers
   */
  private getHeaders(includeAuth = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Make API request with comprehensive error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(requiresAuth);

    try {
      logger.debug('API request initiated', {
        endpoint,
        method: options.method || 'GET',
        hasAuth: requiresAuth && !!this.token,
      });

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;

        logger.error('API request failed', undefined, {
          endpoint,
          status: response.status,
          error: errorMessage,
        });

        // Categorize error by status code
        if (response.status === 401 || response.status === 403) {
          throw new SyncAuthError(
            errorMessage || 'Authentication failed - please sign in again',
            response.status
          );
        }

        if (response.status >= 500) {
          throw new SyncNetworkError(
            errorMessage || `Server error: ${response.status}`,
            response.status
          );
        }

        if (response.status === 400 || response.status === 422) {
          throw new SyncValidationError(
            errorMessage || 'Request validation failed',
            errorData
          );
        }

        // Default to network error for other 4xx errors
        throw new SyncNetworkError(errorMessage, response.status);
      }

      const data = await response.json();

      logger.debug('API request successful', {
        endpoint,
        status: response.status,
      });

      return data;
    } catch (error) {
      // Re-throw typed errors
      if (
        error instanceof SyncAuthError ||
        error instanceof SyncNetworkError ||
        error instanceof SyncValidationError
      ) {
        throw error;
      }

      // Handle network/fetch errors
      logger.error('API request threw error', error instanceof Error ? error : undefined, {
        endpoint,
        errorType: error instanceof Error ? error.constructor.name : 'unknown',
      });

      throw new SyncNetworkError(
        `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Authentication endpoints
  async logout(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }, true);
  }

  async refreshToken(): Promise<{ token: string; expiresAt: number }> {
    return this.request<{ token: string; expiresAt: number }>('/api/auth/refresh', {
      method: 'POST',
    }, true);
  }

  // Sync endpoints

  async push(data: PushRequest): Promise<PushResponse> {
    return this.request<PushResponse>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async pull(data: PullRequest): Promise<PullResponse> {
    return this.request<PullResponse>('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async getStatus(): Promise<SyncStatusResponse> {
    return this.request<SyncStatusResponse>('/api/sync/status', {
      method: 'GET',
    }, true);
  }

  // Device management endpoints

  async listDevices(): Promise<{ devices: DeviceInfo[] }> {
    return this.request<{ devices: DeviceInfo[] }>('/api/devices', {
      method: 'GET',
    }, true);
  }

  async revokeDevice(deviceId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/devices/${deviceId}`, {
      method: 'DELETE',
    }, true);
  }
}

// Singleton instance
let apiClientInstance: SyncApiClient | null = null;

/**
 * Get or create API client instance
 */
export function getApiClient(serverUrl?: string): SyncApiClient {
  if (!apiClientInstance) {
    if (!serverUrl) {
      throw new Error('Server URL required for initial API client creation');
    }
    apiClientInstance = new SyncApiClient(serverUrl);
  }
  return apiClientInstance;
}

/**
 * Clear API client instance
 */
export function clearApiClient(): void {
  apiClientInstance = null;
}
