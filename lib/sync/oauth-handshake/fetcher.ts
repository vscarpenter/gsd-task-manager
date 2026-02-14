/**
 * OAuth result fetching
 * Handles fetching OAuth results from the worker API
 */

import { ENV_CONFIG } from '@/lib/env-config';
import { HTTP_STATUS } from '@/lib/constants/ui';
import type { OAuthHandshakeEvent, OAuthAuthData } from './types';
import { processedStates, pendingFetches, notifyListeners } from './state';

/**
 * Fetch OAuth result from worker API
 */
export async function fetchOAuthResult(state: string): Promise<OAuthHandshakeEvent> {
  try {
    const workerUrl = ENV_CONFIG.apiBaseUrl;

    console.info('[OAuthHandshake] Fetching result from worker', {
      state: state.substring(0, 8) + '...',
      workerUrl,
    });

    const response = await fetch(`${workerUrl}/api/auth/oauth/result?state=${encodeURIComponent(state)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return handleFetchError(state, response.status, data);
    }

    if (data.status === 'success' && data.authData) {
      console.info('[OAuthHandshake] Result received', {
        state: state.substring(0, 8) + '...',
      });

      return {
        status: 'success',
        state,
        authData: data.authData as OAuthAuthData,
      };
    }

    return createErrorResult(state, data);
  } catch (error) {
    console.error('[OAuthHandshake] Fetch threw error', error);
    return {
      status: 'error',
      state,
      error: error instanceof Error ? error.message : 'Network error while completing OAuth.',
    };
  }
}

/**
 * Handle HTTP error responses
 */
function handleFetchError(
  state: string,
  status: number,
  data: Record<string, unknown>
): OAuthHandshakeEvent {
  console.warn('[OAuthHandshake] Fetch failed', {
    state: state.substring(0, 8) + '...',
    status,
    body: data,
  });

  const message =
    (data && (data.message as string)) ||
    (status === HTTP_STATUS.GONE ? 'OAuth result expired. Please try again.' : 'Failed to complete OAuth.');

  return {
    status: 'error',
    state,
    error: message,
  };
}

/**
 * Create error result from response data
 */
function createErrorResult(
  state: string,
  data: Record<string, unknown>
): OAuthHandshakeEvent {
  const errorMessage =
    (data && (data.error as string)) ||
    (data && (data.message as string)) ||
    'OAuth failed. Please try again.';

  return {
    status: 'error',
    state,
    error: errorMessage,
  };
}

/**
 * Initiate OAuth result fetch if not already in progress
 */
export function initiateHandshakeFetch(
  state: string,
  initialError?: string
): void {
  if (processedStates.has(state) || pendingFetches.has(state)) {
    return;
  }

  const fetchPromise = (async () => {
    const result = await fetchOAuthResult(state);

    // If the worker result expired and we received an initial error message, surface it
    if (result.status === 'error' && initialError && !result.error) {
      result.error = initialError;
    }

    processedStates.add(state);
    notifyListeners(result);
  })()
    .catch((error) => {
      processedStates.add(state);
      notifyListeners({
        status: 'error',
        state,
        error: error instanceof Error ? error.message : 'OAuth handshake failed.',
      });
    })
    .finally(() => {
      pendingFetches.delete(state);
    });

  pendingFetches.set(state, fetchPromise);
}
