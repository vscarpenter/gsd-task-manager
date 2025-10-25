/**
 * Token Manager - handles authentication token lifecycle and automatic refresh
 * Prevents sync failures due to token expiration
 */

import { getDb } from '@/lib/db';
import { getApiClient } from './api-client';
import type { SyncConfig } from './types';

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export class TokenManager {
  /**
   * Check if token needs refresh (within 5 minutes of expiry)
   */
  async needsRefresh(): Promise<boolean> {
    const config = await this.getSyncConfig();
    
    if (!config || !config.enabled || !config.tokenExpiresAt) {
      return false;
    }

    const timeUntilExpiry = await this.getTimeUntilExpiry();
    
    // Need refresh if token expires within 5 minutes or already expired
    return timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD_MS;
  }

  /**
   * Ensure token is valid, refresh if needed
   * Returns true if token is valid or was successfully refreshed
   */
  async ensureValidToken(): Promise<boolean> {
    const config = await this.getSyncConfig();
    
    if (!config || !config.enabled) {
      throw new Error('Sync not configured');
    }

    if (!config.token || !config.tokenExpiresAt) {
      throw new Error('No authentication token available');
    }

    // Check if refresh is needed
    const needsRefresh = await this.needsRefresh();
    
    if (!needsRefresh) {
      console.log('[TOKEN] Token is valid, no refresh needed');
      return true;
    }

    console.log('[TOKEN] Token needs refresh, attempting refresh...');
    
    // Attempt to refresh token
    try {
      const api = getApiClient(config.serverUrl);
      api.setToken(config.token);
      
      const response = await api.refreshToken();
      
      // Update stored token and expiration
      await this.updateTokenInConfig(response.token, response.expiresAt);
      
      console.log('[TOKEN] Token refreshed successfully', {
        expiresAt: new Date(response.expiresAt).toISOString(),
      });
      
      return true;
    } catch (error) {
      console.error('[TOKEN] Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Handle 401 Unauthorized errors with automatic token refresh and retry
   * Returns true if token was refreshed successfully
   */
  async handleUnauthorized(): Promise<boolean> {
    console.log('[TOKEN] Handling 401 Unauthorized error');
    
    const config = await this.getSyncConfig();
    
    if (!config || !config.enabled || !config.token) {
      console.error('[TOKEN] Cannot refresh token: sync not configured');
      return false;
    }

    try {
      const api = getApiClient(config.serverUrl);
      api.setToken(config.token);
      
      const response = await api.refreshToken();
      
      // Update stored token and expiration
      await this.updateTokenInConfig(response.token, response.expiresAt);
      
      console.log('[TOKEN] Token refreshed after 401 error', {
        expiresAt: new Date(response.expiresAt).toISOString(),
      });
      
      return true;
    } catch (error) {
      console.error('[TOKEN] Token refresh failed after 401:', error);
      return false;
    }
  }

  /**
   * Get time until token expires (in milliseconds)
   * Returns negative value if already expired
   */
  async getTimeUntilExpiry(): Promise<number> {
    const config = await this.getSyncConfig();
    
    if (!config || !config.tokenExpiresAt) {
      return -1;
    }

    return config.tokenExpiresAt - Date.now();
  }

  /**
   * Get sync configuration from IndexedDB
   */
  private async getSyncConfig(): Promise<SyncConfig | null> {
    const db = getDb();
    const config = await db.syncMetadata.get('sync_config');
    return config as SyncConfig | null;
  }

  /**
   * Update token and expiration in sync config
   */
  private async updateTokenInConfig(token: string, expiresAt: number): Promise<void> {
    const db = getDb();
    const config = await this.getSyncConfig();
    
    if (!config) {
      throw new Error('Sync config not found');
    }

    await db.syncMetadata.put({
      ...config,
      token,
      tokenExpiresAt: expiresAt,
      key: 'sync_config',
    });

    // Update token in API client
    const api = getApiClient(config.serverUrl);
    api.setToken(token);
  }
}

// Singleton instance
let tokenManagerInstance: TokenManager | null = null;

/**
 * Get or create token manager instance
 */
export function getTokenManager(): TokenManager {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new TokenManager();
  }
  return tokenManagerInstance;
}
