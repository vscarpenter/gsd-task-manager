/**
 * Health Monitor - periodically checks sync health
 *
 * Simplified for PocketBase: checks stale queue operations and
 * PB server connectivity. Token management is handled by the SDK.
 */

import { getSyncQueue } from './queue';
import { getPocketBase, isAuthenticated } from './pocketbase-client';
import { getDb } from '@/lib/db';
import type { PBSyncConfig } from './types';

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

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    this.check().catch(() => {
      // Initial check failure is non-fatal
    });

    this.intervalId = setInterval(() => {
      this.check().catch(() => {
        // Periodic check failure is non-fatal
      });
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async check(): Promise<HealthReport> {
    const timestamp = Date.now();

    try {
      const db = getDb();
      const config = await db.syncMetadata.get('sync_config') as PBSyncConfig | undefined;

      if (!config?.enabled) {
        return { healthy: true, issues: [], timestamp };
      }

      const issues: HealthIssue[] = [];

      const staleIssue = await this.checkStaleOperations();
      if (staleIssue) issues.push(staleIssue);

      const authIssue = this.checkAuth();
      if (authIssue) issues.push(authIssue);

      const connectivityIssue = await this.checkServerConnectivity();
      if (connectivityIssue) issues.push(connectivityIssue);

      return { healthy: issues.length === 0, issues, timestamp };
    } catch {
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
  }

  private async checkStaleOperations(): Promise<HealthIssue | null> {
    const queue = getSyncQueue();
    const pendingOps = await queue.getPending();

    if (pendingOps.length === 0) return null;

    const now = Date.now();
    const staleOps = pendingOps.filter(op => now - op.timestamp > STALE_OPERATION_THRESHOLD_MS);

    if (staleOps.length === 0) return null;

    return {
      type: 'stale_queue',
      severity: 'warning',
      message: `${staleOps.length} pending operations are older than 1 hour`,
      suggestedAction: 'Try syncing manually to clear pending operations',
    };
  }

  private checkAuth(): HealthIssue | null {
    if (!isAuthenticated()) {
      return {
        type: 'token_expired',
        severity: 'error',
        message: 'Authentication token has expired',
        suggestedAction: 'Sign in again to continue syncing',
      };
    }
    return null;
  }

  private async checkServerConnectivity(): Promise<HealthIssue | null> {
    try {
      const pb = getPocketBase();
      await pb.health.check();
      return null;
    } catch {
      return {
        type: 'server_unreachable',
        severity: 'error',
        message: 'Cannot reach PocketBase server',
        suggestedAction: 'Check your internet connection and try again',
      };
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

let healthMonitorInstance: HealthMonitor | null = null;

export function getHealthMonitor(): HealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new HealthMonitor();
  }
  return healthMonitorInstance;
}
