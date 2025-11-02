/**
 * Centralized environment configuration
 * Single source of truth for environment-dependent URLs and settings
 */

export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  /** API base URL for sync worker */
  apiBaseUrl: string;
  /** OAuth callback URL for auth flow */
  oauthCallbackUrl: string;
  /** Whether running in development mode */
  isDevelopment: boolean;
  /** Whether running in production mode */
  isProduction: boolean;
  /** Whether running in staging mode */
  isStaging: boolean;
  /** Current environment */
  environment: Environment;
}

/**
 * Detect current environment from hostname
 */
function detectEnvironment(): Environment {
  if (typeof window === 'undefined') {
    // SSR/SSG - default to production
    return 'production';
  }

  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }

  if (hostname === 'gsd-dev.vinny.dev') {
    return 'staging';
  }

  return 'production';
}

/**
 * Get environment configuration based on current hostname
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const environment = detectEnvironment();

  // API Base URL configuration
  const apiBaseUrl =
    environment === 'development'
      ? 'http://localhost:8787'
      : environment === 'staging'
      ? 'https://api-dev.vinny.dev'
      : typeof window !== 'undefined'
      ? window.location.origin // Use same-origin (CloudFront proxies /api/* to worker)
      : 'https://gsd.vinny.dev';

  // OAuth Callback URL configuration
  const oauthCallbackUrl =
    environment === 'development'
      ? 'http://localhost:3000/auth/callback'
      : environment === 'staging'
      ? 'https://gsd-dev.vinny.dev/auth/callback'
      : 'https://gsd.vinny.dev/auth/callback';

  return {
    apiBaseUrl,
    oauthCallbackUrl,
    isDevelopment: environment === 'development',
    isProduction: environment === 'production',
    isStaging: environment === 'staging',
    environment,
  };
}

/**
 * Singleton instance - computed once on module load
 */
export const ENV_CONFIG = getEnvironmentConfig();
