// Server-side cryptography utilities
// Note: Server never has access to user's encryption keys

import { CRYPTO_BUFFER } from '../constants/security';

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
 * Convert ArrayBuffer or Uint8Array to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}
