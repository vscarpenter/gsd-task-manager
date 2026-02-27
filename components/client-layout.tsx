"use client";

import { useEffect } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { getDb } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import type { SyncConfig } from '@/lib/sync/types';

const logger = createLogger('AUTH');

/**
 * Client-side layout wrapper that initializes Supabase Auth on mount.
 * Ensures the OAuth callback hash (#access_token=...) is consumed on page load,
 * and persists sync config to IndexedDB so the sync button reflects auth state.
 */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          const user = session.user;
          logger.info('Auth session detected', {
            event,
            provider: user.app_metadata?.provider,
            email: user.email,
          });

          // Persist sync config if not already present
          const db = getDb();
          const existing = await db.syncMetadata.get('sync_config') as SyncConfig | undefined;
          if (existing?.enabled) return; // Already configured

          const deviceId = existing?.deviceId ?? crypto.randomUUID();
          const deviceName = existing?.deviceName ?? (navigator?.userAgent?.includes('Mac') ? 'Mac' : 'Desktop');

          await db.syncMetadata.put({
            key: 'sync_config',
            enabled: true,
            userId: user.id,
            deviceId,
            deviceName,
            email: user.email ?? '',
            lastSyncAt: null,
            conflictStrategy: 'last_write_wins',
            provider: user.app_metadata?.provider ?? 'unknown',
            consecutiveFailures: 0,
            lastFailureAt: null,
            lastFailureReason: null,
            nextRetryAt: null,
            autoSyncEnabled: true,
            autoSyncIntervalMinutes: 2,
          } satisfies SyncConfig);

          logger.info('Sync config persisted after auth');
        } else if (event === 'SIGNED_OUT') {
          logger.info('Auth session ended');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
