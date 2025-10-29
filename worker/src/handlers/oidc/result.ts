import type { Env } from '../../types';
import { jsonResponse, errorResponse } from '../../middleware/cors';

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

  await env.KV.delete(resultKey);

  const result = JSON.parse(resultStr) as {
    status: 'success' | 'error';
    authData?: Record<string, unknown>;
    error?: string;
  };

  if (result.status === 'error') {
    return jsonResponse(
      {
        status: 'error',
        error: result.error || 'OAuth failed',
      },
      200,
      origin
    );
  }

  return jsonResponse(
    {
      status: 'success',
      authData: result.authData,
    },
    200,
    origin
  );
}
