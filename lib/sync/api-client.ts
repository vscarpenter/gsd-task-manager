/**
 * API client for Cloudflare Worker sync backend
 */

import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  PushRequest,
  PushResponse,
  PullRequest,
  PullResponse,
  SyncStatusResponse,
  DeviceInfo,
} from './types';

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
   * Make API request with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresAuth = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(requiresAuth);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Authentication endpoints

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

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
