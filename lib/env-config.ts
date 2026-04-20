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

const KNOWN_REMOTE_POCKETBASE_HOSTS = new Map<string, string>([
  ['gsd.vinny.dev', 'https://api.vinny.io'],
  ['gsd-dev.vinny.dev', 'https://api.vinny.io'],
]);

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
 * Development keeps the existing localhost behavior.
 * Known hosted domains may map to a dedicated PocketBase host.
 * Unknown HTTPS deployments fall back to same-origin, which is safe for the
 * documented self-hosted reverse-proxy setup and avoids sending data to an
 * unrelated default backend.
 */
function resolvePocketBaseUrl(environment: Environment): string {
  if (typeof window === 'undefined') {
    return environment === 'development'
      ? 'http://127.0.0.1:8090'
      : 'https://api.vinny.io';
  }

  if (
    environment === 'development' &&
    window.location.protocol === 'https:'
  ) {
    return window.location.origin;
  }

  const mappedPocketBaseUrl = KNOWN_REMOTE_POCKETBASE_HOSTS.get(window.location.hostname);
  if (mappedPocketBaseUrl) {
    return mappedPocketBaseUrl;
  }

  return environment === 'development'
    ? 'http://127.0.0.1:8090'
    : window.location.origin;
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
