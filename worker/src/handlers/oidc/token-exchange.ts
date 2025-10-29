import type { Env } from '../../types';
import { GOOGLE_CONFIG, APPLE_CONFIG } from '../../config';
import { createLogger } from '../../utils/logger';
import { generateAppleClientSecret } from './helpers';

const logger = createLogger('OIDC:TokenExchange');

export interface TokenExchangeResult {
  access_token?: string;
  id_token?: string;
}

/**
 * Exchange authorization code for tokens
 * Handles both Google and Apple token endpoints
 */
export async function exchangeCodeForTokens(
  provider: 'google' | 'apple',
  code: string,
  codeVerifier: string,
  redirectUri: string,
  env: Env
): Promise<TokenExchangeResult> {
  const config = provider === 'google' ? GOOGLE_CONFIG : APPLE_CONFIG;
  const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID;

  // Build token request parameters
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  // Add client_secret for both providers
  if (provider === 'google') {
    tokenParams.set('client_secret', env.GOOGLE_CLIENT_SECRET);
  } else if (provider === 'apple') {
    const clientSecret = await generateAppleClientSecret(env);
    tokenParams.set('client_secret', clientSecret);
  }

  logger.info('Token exchange request', {
    provider,
    redirect_uri: tokenParams.get('redirect_uri'),
    client_id: tokenParams.get('client_id'),
    token_endpoint: config.token_endpoint,
  });

  const tokenResponse = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    logger.error('Token exchange failed', new Error(errorText), {
      provider,
      redirect_uri: tokenParams.get('redirect_uri'),
      error: errorText,
    });
    throw new Error('Token exchange failed');
  }

  const tokens = await tokenResponse.json() as TokenExchangeResult;

  if (!tokens.id_token) {
    logger.error('No ID token received', new Error('Missing id_token'), { provider });
    throw new Error('No ID token received');
  }

  logger.info('Token exchange successful', { provider });
  return tokens;
}
