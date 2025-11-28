import type { Env } from '../../types';
import { generateId } from '../../utils/crypto';
import { createLogger } from '../../utils/logger';

const logger = createLogger('OIDC:UserManager');

export interface UserData {
  id: string;
  email: string;
  account_status: string;
  encryption_salt: string | null;
}

export interface UserLookupResult {
  success: true;
  user: UserData;
  isNewUser: boolean;
}

export interface UserLookupError {
  success: false;
  error: string;
  statusCode: number;
}

export type UserLookupOutcome = UserLookupResult | UserLookupError;

/**
 * Find existing user or create a new one
 * Handles race conditions for concurrent user creation
 */
export async function findOrCreateUser(
  provider: string,
  providerUserId: string,
  email: string,
  env: Env
): Promise<UserLookupOutcome> {
  const now = Date.now();

  // Look up existing user by provider
  const existingUser = await env.DB.prepare(
    'SELECT id, email, account_status, encryption_salt FROM users WHERE auth_provider = ? AND provider_user_id = ?'
  )
    .bind(provider, providerUserId)
    .first();

  if (existingUser) {
    return handleExistingUser(existingUser, now, env);
  }

  // User doesn't exist, create new one
  return createNewUser(provider, providerUserId, email, now, env);
}

async function handleExistingUser(
  user: Record<string, unknown>,
  now: number,
  env: Env
): Promise<UserLookupOutcome> {
  if (user.account_status !== 'active') {
    return {
      success: false,
      error: 'Account is suspended or deleted',
      statusCode: 403,
    };
  }

  // Update last login
  await env.DB.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, user.id)
    .run();

  return {
    success: true,
    user: {
      id: user.id as string,
      email: user.email as string,
      account_status: user.account_status as string,
      encryption_salt: (user.encryption_salt as string) || null,
    },
    isNewUser: false,
  };
}

async function createNewUser(
  provider: string,
  providerUserId: string,
  email: string,
  now: number,
  env: Env
): Promise<UserLookupOutcome> {
  // Check if email is already registered with a different provider
  const emailCollision = await checkEmailCollision(email, env);
  if (emailCollision) {
    return emailCollision;
  }

  try {
    const userId = generateId();
    await env.DB.prepare(
      `INSERT INTO users (id, email, auth_provider, provider_user_id, created_at, updated_at, account_status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    )
      .bind(userId, email, provider, providerUserId, now, now)
      .run();

    return {
      success: true,
      user: {
        id: userId,
        email,
        account_status: 'active',
        encryption_salt: null,
      },
      isNewUser: true,
    };
  } catch (error: unknown) {
    return handleUserCreationError(error, email, provider, env);
  }
}

async function checkEmailCollision(
  email: string,
  env: Env
): Promise<UserLookupError | null> {
  const existingUser = await env.DB.prepare('SELECT auth_provider FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (existingUser) {
    const existingProvider = existingUser.auth_provider as string;
    const providerName = existingProvider === 'google' ? 'Google' : 'Apple';

    return {
      success: false,
      error: `This email is already registered with ${providerName}. Please sign in with ${providerName} or use a different email address.`,
      statusCode: 409,
    };
  }

  return null;
}

async function handleUserCreationError(
  error: unknown,
  email: string,
  provider: string,
  env: Env
): Promise<UserLookupOutcome> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Handle race condition: concurrent insert with same email
  if (errorMessage.includes('UNIQUE constraint failed: users.email')) {
    logger.warn('Race condition detected: concurrent user creation', {
      email,
      provider,
      error: errorMessage,
    });

    // Re-query to get the actual provider that won the race
    const actualUser = await env.DB.prepare('SELECT auth_provider FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (actualUser) {
      const providerName = actualUser.auth_provider === 'google' ? 'Google' : 'Apple';
      return {
        success: false,
        error: `This email is already registered with ${providerName}. Please sign in with ${providerName} or use a different email address.`,
        statusCode: 409,
      };
    }
  }

  // Re-throw if it's a different error
  logger.error('User creation failed', error as Error, { email, provider });
  throw error;
}
