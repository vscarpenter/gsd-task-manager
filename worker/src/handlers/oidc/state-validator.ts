import type { Env } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OIDC:StateValidator');

export type OAuthProvider = 'google' | 'apple';

export interface OAuthStateData {
  codeVerifier: string;
  provider: OAuthProvider;
  redirectUri: string;
  appOrigin: string | null;
  createdAt: number;
  sessionId: string;
}

export interface StateValidationResult {
  success: true;
  stateData: OAuthStateData;
}

export interface StateValidationError {
  success: false;
  error: string;
  statusCode: number;
}

export type StateValidationOutcome = StateValidationResult | StateValidationError;

/**
 * Validate OAuth state from KV and return parsed state data
 */
export async function validateOAuthState(
  state: string,
  env: Env,
  request: Request,
  origin: string | null
): Promise<StateValidationOutcome> {
  const stateKey = `oauth_state:${state}`;
  const stateDataStr = await env.KV.get(stateKey);

  if (!stateDataStr) {
    logger.warn('OAuth state not found in KV', {
      statePrefix: state.substring(0, 8) + '...',
      stateLength: state.length,
      stateKey,
      url: request.url,
      timeNow: new Date().toISOString(),
      userAgent: request.headers.get('User-Agent'),
      origin,
    });

    return {
      success: false,
      error:
        'OAuth session expired or invalid. Please try signing in again. ' +
        '(State not found - this may happen if the sign-in flow took longer than 30 minutes)',
      statusCode: 400,
    };
  }

  const stateData = JSON.parse(stateDataStr) as OAuthStateData;

  if (!stateData.sessionId) {
    logger.warn('OAuth state missing session binding', {
      statePrefix: state.substring(0, 8) + '...',
    });

    return {
      success: false,
      error: 'OAuth session invalid or expired. Please retry sign in.',
      statusCode: 400,
    };
  }

  // Log timing information for diagnostics
  const now = Date.now();
  const flowDuration = stateData.createdAt ? now - stateData.createdAt : null;

  logger.info('OAuth callback received - state valid', {
    provider: stateData.provider,
    statePrefix: state.substring(0, 8) + '...',
    flowDurationMs: flowDuration,
    flowDurationSec: flowDuration ? Math.round(flowDuration / 1000) : null,
    userAgent: request.headers.get('User-Agent'),
  });

  return { success: true, stateData };
}

/**
 * Delete the OAuth state from KV after successful validation
 */
export async function deleteOAuthState(state: string, env: Env): Promise<void> {
  const stateKey = `oauth_state:${state}`;
  await env.KV.delete(stateKey);
}
