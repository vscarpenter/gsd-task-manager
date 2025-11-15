import type { Env } from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { OAUTH_COOKIE } from '../../config';
import { createCookie, getCookie } from '../../utils/cookies';

/**
 * Retrieve OAuth result using state token
 * GET /api/auth/oauth/result?state=...
 */
export async function getOAuthResult(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  const state = url.searchParams.get('state');

  if (!state) {
    return errorResponse('Missing state parameter', 400, origin);
  }

  const oauthSession = getCookie(request.headers.get('Cookie'), OAUTH_COOKIE.name);

  if (!oauthSession) {
    return errorResponse('Missing OAuth session cookie', 401, origin);
  }

  const resultKey = `oauth_result:${state}`;
  const resultStr = await env.KV.get(resultKey);

  if (!resultStr) {
    return jsonResponse(
      {
        status: 'expired',
        message: 'OAuth result not found or expired',
      },
      410,
      origin
    );
  }

  const result = JSON.parse(resultStr) as {
    status: 'success' | 'error';
    authData?: Record<string, unknown>;
    error?: string;
    sessionId?: string | null;
  };

  if (!result.sessionId || result.sessionId !== oauthSession) {
    return errorResponse('OAuth session validation failed', 401, origin);
  }

  await env.KV.delete(resultKey);

  const clearCookie = createCookie(OAUTH_COOKIE.name, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure: url.protocol === 'https:',
    maxAge: 0,
    expires: new Date(0),
  });

  if (result.status === 'error') {
    const response = jsonResponse(
      {
        status: 'error',
        error: result.error || 'OAuth failed',
      },
      200,
      origin
    );
    response.headers.append('Set-Cookie', clearCookie);
    return response;
  }

  const response = jsonResponse(
    {
      status: 'success',
      authData: result.authData,
    },
    200,
    origin
  );
  response.headers.append('Set-Cookie', clearCookie);
  return response;
}
