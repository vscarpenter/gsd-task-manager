/**
 * Centralized environment configuration
 * Single source of truth for environment-dependent URLs and settings
 */

export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  /** Supabase project URL */
  supabaseUrl: string;
  /** Supabase anon (publishable) key */
  supabaseAnonKey: string;
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

  return 'production';
}

/**
 * Get environment configuration based on current hostname
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const environment = detectEnvironment();

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
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
