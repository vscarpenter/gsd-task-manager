/**
 * PocketBase client singleton
 *
 * Provides a configured PocketBase SDK instance pointed at the self-hosted
 * server. The SDK auto-stores auth state in localStorage and handles token
 * refresh internally, eliminating the need for a custom TokenManager.
 */

import PocketBase from 'pocketbase';
import { ENV_CONFIG } from '@/lib/env-config';

let pbInstance: PocketBase | null = null;

/**
 * Get or create the PocketBase client singleton
 * The SDK persists auth in localStorage automatically via its AuthStore.
 */
export function getPocketBase(): PocketBase {
  if (!pbInstance) {
    pbInstance = new PocketBase(ENV_CONFIG.pocketBaseUrl);
    // Disable auto-cancellation so concurrent requests don't cancel each other
    pbInstance.autoCancellation(false);
  }
  return pbInstance;
}

/**
 * Destroy the singleton (used on logout / reset)
 */
export function clearPocketBase(): void {
  if (pbInstance) {
    pbInstance.authStore.clear();
    pbInstance = null;
  }
}

/**
 * Check if the current user is authenticated
 */
export function isAuthenticated(): boolean {
  const pb = getPocketBase();
  return pb.authStore.isValid;
}

/**
 * Get the authenticated user's PocketBase record ID (used as owner FK)
 */
export function getCurrentUserId(): string | null {
  const pb = getPocketBase();
  if (!pb.authStore.isValid) return null;
  return pb.authStore.record?.id ?? null;
}

