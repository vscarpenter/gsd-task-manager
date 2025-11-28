import type { Env } from '../../types';
import { errorResponse } from '../../middleware/cors';
import { createLogger } from '../../utils/logger';
import { exchangeCodeForTokens } from './token-exchange';
import { verifyIdToken } from './id-verification';
import { parseOAuthRequest } from './request-parser';
import { validateOAuthState, deleteOAuthState } from './state-validator';
import { findOrCreateUser } from './user-manager';
import { createDevice, createSession, buildAuthData, storeOAuthResult } from './session-manager';
import {
  buildSuccessRedirect,
  buildSuccessJson,
  buildErrorRedirect,
  buildErrorJson,
  getErrorContext,
  storeErrorResult,
  buildStateExpiredRedirect,
} from './response-builder';
import { getAppOriginFromRequest } from './helpers';

const logger = createLogger('OIDC:Callback');

/**
 * Handle OAuth callback
 * POST /api/auth/oauth/callback
 */
export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');

  try {
    // Parse request to extract code and state
    const { code, state } = await parseOAuthRequest(request);

    if (!code || !state) {
      logger.warn('Invalid callback parameters', {
        hasCode: !!code,
        hasState: !!state,
        url: request.url,
      });
      return errorResponse('Invalid callback parameters', 400, origin);
    }

    // Validate OAuth state from KV
    const stateResult = await validateOAuthState(state, env, request, origin);
    if (!stateResult.success) {
      // For state-not-found errors, redirect back to app with friendly error
      // This handles cases like: expired states, PWA lifecycle issues, cached OAuth URLs
      const appOrigin = getAppOriginFromRequest(request, env);

      logger.warn('OAuth state validation failed, redirecting to app', {
        error: stateResult.error,
        statusCode: stateResult.statusCode,
        appOrigin,
        statePrefix: state.substring(0, 8) + '...',
      });

      if (appOrigin) {
        return buildStateExpiredRedirect(appOrigin, stateResult.error);
      }

      // Fallback to JSON error if no app origin can be determined
      return errorResponse(stateResult.error, stateResult.statusCode, origin);
    }

    const { stateData } = stateResult;
    const { codeVerifier, provider, redirectUri, appOrigin, sessionId } = stateData;

    // Delete used state
    await deleteOAuthState(state, env);

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(provider, code, codeVerifier, redirectUri, env);

    // Verify ID token and extract user info
    const { email, providerUserId } = await verifyIdToken(provider, tokens.id_token!, env);

    // Find or create user
    const userResult = await findOrCreateUser(provider, providerUserId, email, env);
    if (!userResult.success) {
      return errorResponse(userResult.error, userResult.statusCode, origin);
    }

    const { user, isNewUser } = userResult;

    // Create device and session
    const deviceId = await createDevice(user.id, provider, env);
    const session = await createSession(user.id, user.email, deviceId, env);

    // Build auth data and store result
    const authData = buildAuthData(user.id, user.email, session, user.encryption_salt, provider);
    await storeOAuthResult(state, authData, appOrigin, sessionId, env);

    logger.info('OAuth callback successful', {
      userId: user.id,
      deviceId,
      provider,
      isNewUser,
      state,
      appOrigin,
    });

    // Return redirect or JSON response
    if (appOrigin) {
      return buildSuccessRedirect(appOrigin, state);
    }

    return buildSuccessJson(state, origin);
  } catch (error: unknown) {
    return handleCallbackError(error, request, env, origin);
  }
}

/**
 * Handle errors during OAuth callback
 */
async function handleCallbackError(
  error: unknown,
  request: Request,
  env: Env,
  origin: string | null
): Promise<Response> {
  logger.error('OAuth callback failed', error as Error, { provider: 'unknown' });

  const url = new URL(request.url);
  const state = url.searchParams.get('state');

  if (!state) {
    return buildErrorJson(error, origin, env);
  }

  // Try to get context from state
  const { appOrigin, sessionId } = await getErrorContext(state, env);
  const message = error instanceof Error ? error.message : 'OAuth callback failed';

  // Store error result for later retrieval
  await storeErrorResult(state, message, appOrigin || origin, sessionId, env);

  const redirectTarget = appOrigin || origin;

  if (redirectTarget) {
    return buildErrorRedirect(redirectTarget, state, message);
  }

  return buildErrorJson(error, origin, env);
}
