/**
 * Health Monitor - periodically checks sync health and triggers corrective actions
 * Detects stale operations, token expiration, and server connectivity issues
 */

import { getSyncQueue } from './queue';
import { getTokenManager } from './token-manager';
import { getApiClient } from './api-client';
import { getDb } from '@/lib/db';
import type { SyncConfig } from './types';

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_OPERATION_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export interface HealthIssue {
  type: 'stale_queue' | 'token_expired' | 'server_unreachable';
  severity: 'warning' | 'error';
  message: string;
  suggestedAction: string;
}

export interface HealthReport {
  healthy: boolean;
  issues: HealthIssue[];
  timestamp: number;
}

export class HealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start periodic health checks (5-minute interval)
   */
  start(): void {
    if (this.isRunning) {
      console.log('[HEALTH] Health monitor already running');
      return;
    }

    console.log('[HEALTH] Starting health monitor with 5-minute interval');
    this.isRunning = true;

    // Run initial check immediately
    this.check().catch(error => {
      console.error('[HEALTH] Initial health check failed:', error);
    });

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.check().catch(error => {
        console.error('[HEALTH] Periodic health check failed:', error);
      });
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Stop health checks and clear interval
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[HEALTH] Health monitor not running');
      return;
    }

    console.log('[HEALTH] Stopping health monitor');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run immediate health check and return report
   */
  async check(): Promise<HealthReport> {
    console.log('[HEALTH] Running health check...');
    const timestamp = Date.now();

    try {
      const config = await this.getSyncConfig();
      if (!config || !config.enabled) {
        console.log('[HEALTH] Sync not enabled, skipping health check');
        return { healthy: true, issues: [], timestamp };
      }

      const issues = await this.runAllHealthChecks(config);
      this.logHealthCheckResults(issues);

      return { healthy: issues.length === 0, issues, timestamp };
    } catch (error) {
      console.error('[HEALTH] Health check error:', error);
      return this.createErrorReport(timestamp);
    }
  }

  /** Run all health checks and collect issues */
  private async runAllHealthChecks(config: SyncConfig): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = [];
    const staleIssue = await this.checkStaleOperations();
    const tokenIssue = await this.checkTokenExpiration();
    const connectivityIssue = await this.checkServerConnectivity(config);

    if (staleIssue) issues.push(staleIssue);
    if (tokenIssue) issues.push(tokenIssue);
    if (connectivityIssue) issues.push(connectivityIssue);

    return issues;
  }

  /** Log health check results */
  private logHealthCheckResults(issues: HealthIssue[]): void {
    console.log('[HEALTH] Health check complete:', {
      healthy: issues.length === 0,
      issuesFound: issues.length,
      issues: issues.map(i => ({ type: i.type, severity: i.severity })),
    });
  }

  /** Create error report for failed health check */
  private createErrorReport(timestamp: number): HealthReport {
    return {
      healthy: false,
      issues: [{
        type: 'server_unreachable',
        severity: 'error',
        message: 'Health check failed',
        suggestedAction: 'Check your internet connection and try again',
      }],
      timestamp,
    };
  }

  /**
   * Check for stale queue operations (>1 hour old)
   */
  private async checkStaleOperations(): Promise<HealthIssue | null> {
    const queue = getSyncQueue();
    const pendingOps = await queue.getPending();

    if (pendingOps.length === 0) {
      return null;
    }

    const now = Date.now();
    const staleOps = pendingOps.filter(op => {
      const age = now - op.timestamp;
      return age > STALE_OPERATION_THRESHOLD_MS;
    });

    if (staleOps.length === 0) {
      return null;
    }

    console.log('[HEALTH] Found stale operations:', {
      total: pendingOps.length,
      stale: staleOps.length,
      oldestAge: Math.max(...staleOps.map(op => now - op.timestamp)),
    });

    return {
      type: 'stale_queue',
      severity: 'warning',
      message: `${staleOps.length} pending operations are older than 1 hour`,
      suggestedAction: 'Try syncing manually to clear pending operations',
    };
  }

  /** Create expired token issue */
  private createExpiredTokenIssue(): HealthIssue {
    return {
      type: 'token_expired',
      severity: 'error',
      message: 'Authentication token has expired',
      suggestedAction: 'Sign in again to continue syncing',
    };
  }

  /** Create token refresh failed issue */
  private createRefreshFailedIssue(): HealthIssue {
    return {
      type: 'token_expired',
      severity: 'warning',
      message: 'Authentication token is expiring soon and refresh failed',
      suggestedAction: 'Sign in again to continue syncing',
    };
  }

  /**
   * Check token expiration and attempt refresh if needed
   */
  private async checkTokenExpiration(): Promise<HealthIssue | null> {
    const tokenManager = getTokenManager();
    const timeUntilExpiry = await tokenManager.getTimeUntilExpiry();

    if (timeUntilExpiry < 0) {
      console.log('[HEALTH] Token has expired');
      return this.createExpiredTokenIssue();
    }

    const needsRefresh = await tokenManager.needsRefresh();
    if (!needsRefresh) return null;

    console.log('[HEALTH] Token needs refresh, attempting automatic refresh...');
    const refreshed = await tokenManager.ensureValidToken();

    if (!refreshed) {
      console.log('[HEALTH] Token refresh failed');
      return this.createRefreshFailedIssue();
    }

    console.log('[HEALTH] Token refreshed successfully');
    return null;
  }

  /**
   * Check server connectivity with lightweight ping
   */
  private async checkServerConnectivity(config: SyncConfig): Promise<HealthIssue | null> {
    try {
      const api = getApiClient(config.serverUrl);
      api.setToken(config.token);

      // Use the status endpoint as a lightweight health check
      await api.getStatus();
      
      console.log('[HEALTH] Server connectivity OK');
      return null;
    } catch (error) {
      console.error('[HEALTH] Server connectivity check failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        type: 'server_unreachable',
        severity: 'error',
        message: `Cannot reach sync server: ${errorMessage}`,
        suggestedAction: 'Check your internet connection and try again',
      };
    }
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
   * Check if health monitor is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let healthMonitorInstance: HealthMonitor | null = null;

/**
 * Get or create health monitor instance
 */
export function getHealthMonitor(): HealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new HealthMonitor();
  }
  return healthMonitorInstance;
}
