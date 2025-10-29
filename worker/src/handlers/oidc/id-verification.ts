import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { Env } from '../../types';
import { GOOGLE_CONFIG, APPLE_CONFIG } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OIDC:IDVerification');

export interface VerifiedUserInfo {
  email: string;
  providerUserId: string;
  emailVerified: boolean;
}

/**
 * Verify ID token and extract user information
 * Uses JWKS for signature verification
 */
export async function verifyIdToken(
  provider: 'google' | 'apple',
  idToken: string,
  env: Env
): Promise<VerifiedUserInfo> {
  const config = provider === 'google' ? GOOGLE_CONFIG : APPLE_CONFIG;
  const clientId = provider === 'google' ? env.GOOGLE_CLIENT_ID : env.APPLE_CLIENT_ID;

  logger.info('Verifying ID token', { provider });

  // Verify ID token using JWKS
  const JWKS = createRemoteJWKSet(new URL(config.jwks_uri));
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: config.issuer,
    audience: clientId,
  });

  // Extract user info
  const email = payload.email as string;
  const providerUserId = payload.sub as string;
  const emailVerified = payload.email_verified as boolean;

  if (!email || !emailVerified) {
    logger.error('Email not verified', new Error('Email verification failed'), {
      provider,
      email,
      emailVerified,
    });
    throw new Error('Email not verified');
  }

  logger.info('ID token verified successfully', { provider, email });

  return {
    email,
    providerUserId,
    emailVerified,
  };
}
