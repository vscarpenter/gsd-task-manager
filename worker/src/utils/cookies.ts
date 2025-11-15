/**
 * Lightweight cookie utilities for Cloudflare Workers
 */

export interface CookieOptions {
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  maxAge?: number;
  expires?: Date;
}

/**
 * Build a Set-Cookie header value
 */
export function createCookie(name: string, value: string, options: CookieOptions = {}): string {
  const segments = [`${name}=${value}`];
  segments.push(`Path=${options.path ?? '/'}`);

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  if (options.expires) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.httpOnly) {
    segments.push('HttpOnly');
  }

  if (options.secure) {
    segments.push('Secure');
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  return segments.join('; ');
}

/**
 * Parse cookies from a Cookie header
 */
export function getCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;

  const cookies = header.split(';');
  for (const cookie of cookies) {
    const [rawKey, ...rest] = cookie.trim().split('=');
    if (rawKey === name) {
      return rest.join('=');
    }
  }
  return undefined;
}
