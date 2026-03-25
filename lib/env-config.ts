/**
 * Centralized environment configuration
 * Single source of truth for environment-dependent URLs and settings
 */

export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  /** PocketBase server URL */
  pocketBaseUrl: string;
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

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return 'development';
  }

  if (hostname === 'gsd-dev.vinny.dev') {
    return 'staging';
  }

  if (hostname === 'gsd.vinny.dev') {
    return 'production';
  }

  // Unknown hostname — treat as production but require explicit PocketBase URL
  return 'production';
}

/**
 * Resolve PocketBase URL based on environment and protocol.
 * Self-hosted (Docker): HTTPS on localhost means PocketBase is behind a reverse proxy at the same origin.
 * Development (bun dev): HTTP on localhost uses the default local PocketBase port.
 */
function resolvePocketBaseUrl(environment: Environment): string {
  if (
    environment === 'development' &&
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:'
  ) {
    return window.location.origin;
  }

  return environment === 'development'
    ? 'http://127.0.0.1:8090'
    : 'https://api.vinny.io';
}

/**
 * Get environment configuration based on current hostname
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const environment = detectEnvironment();

  const pocketBaseUrl =
    process.env.NEXT_PUBLIC_POCKETBASE_URL ||
    resolvePocketBaseUrl(environment);

  return {
    pocketBaseUrl,
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
