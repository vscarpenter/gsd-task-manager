/**
 * OAuth handshake event subscription
 */

import { toast } from 'sonner';
import type { OAuthHandshakeEvent } from './types';
import { listeners, processedStates } from './state';
import { ensureInitialized } from './initializer';
import { initiateHandshakeFetch } from './fetcher';

/**
 * Subscribe to OAuth handshake events
 * @param listener Callback function to receive OAuth events
 * @returns Unsubscribe function
 */
export function subscribeToOAuthHandshake(
  listener: (event: OAuthHandshakeEvent) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  ensureInitialized();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Retry OAuth handshake for a given state
 * Useful for manual retries or diagnostics
 */
export async function retryOAuthHandshake(state: string): Promise<void> {
  if (processedStates.has(state)) {
    processedStates.delete(state);
  }
  initiateHandshakeFetch(state, true);
}

/**
 * Default listener that shows toast errors when no other listeners are registered
 * Ensures user gets feedback even if app forgot to subscribe
 */
subscribeToOAuthHandshake((event) => {
  console.info('[OAuthHandshake] Event delivered to default listener', {
    status: event.status,
    state: event.state.substring(0, 8) + '...',
  });
  // Only show toast if this is the only listener (the default one)
  if (listeners.size <= 1) {
    if (event.status === 'error') {
      toast.error(event.error);
    }
  }
});
