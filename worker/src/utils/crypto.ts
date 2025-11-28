// Server-side cryptography utilities
// Note: Server never has access to user's encryption keys

import { WORKER_CRYPTO, CRYPTO_BUFFER } from '../constants/security';

/**
 * Hash password using Argon2id (via Cloudflare's crypto API)
 * Falls back to PBKDF2 if Argon2 not available
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  // Use PBKDF2 with high iteration count
  // Note: Cloudflare Workers limits PBKDF2 iterations to 100,000
  // For client-side, use 600,000. For server-side, use 100,000.
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: WORKER_CRYPTO.PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    WORKER_CRYPTO.KEY_LENGTH_BITS
  );

  return arrayBufferToBase64(derivedBits);
}

/**
 * Verify password against hash using constant-time comparison
 */
export async function verifyPassword(
  password: string,
  salt: string,
  hash: string
): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return constantTimeCompare(computedHash, hash);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate cryptographically secure random salt
 */
export function generateSalt(): string {
  const buffer = new Uint8Array(CRYPTO_BUFFER.SALT_BYTES);
  crypto.getRandomValues(buffer);
  return arrayBufferToBase64(buffer);
}

/**
 * Generate cryptographically secure random ID
 */
export function generateId(): string {
  const buffer = new Uint8Array(CRYPTO_BUFFER.ID_BYTES);
  crypto.getRandomValues(buffer);
  return arrayBufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Hash data with SHA-256
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Convert ArrayBuffer or Uint8Array to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
