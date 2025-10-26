/**
 * Encryption/Decryption utilities for MCP server
 * Port of client-side crypto logic to Node.js
 * Uses Node.js Web Crypto API (available in Node 15+)
 */

import { webcrypto } from 'node:crypto';

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation
const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';
const NONCE_LENGTH = 12; // 96 bits

export class CryptoManager {
  private encryptionKey: webcrypto.CryptoKey | null = null;
  private salt: string | null = null;

  /**
   * Derive encryption key from passphrase and salt
   */
  async deriveKey(passphrase: string, salt: string): Promise<void> {
    this.salt = salt;

    const encoder = new TextEncoder();
    const passphraseBuffer = encoder.encode(passphrase);

    // Salt comes from Worker as comma-separated byte values (e.g., "140,160,92,...")
    // This matches how GSD client stores it: Array.from(salt)
    const saltNumbers = salt.split(',').map(n => parseInt(n.trim(), 10));
    const saltBuffer = new Uint8Array(saltNumbers);

    // Import passphrase as key material
    const keyMaterial = await webcrypto.subtle.importKey(
      'raw',
      passphraseBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive encryption key using PBKDF2
    this.encryptionKey = await webcrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['decrypt'] // We only need decrypt in MCP server
    );
  }

  /**
   * Decrypt ciphertext data
   * Returns plaintext string
   */
  async decrypt(ciphertext: string, nonce: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized. Call deriveKey() first.');
    }

    const ciphertextBuffer = this.base64ToBuffer(ciphertext);
    const nonceBuffer = this.base64ToBuffer(nonce);

    try {
      const plaintextBuffer = await webcrypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv: nonceBuffer,
          tagLength: 128,
        },
        this.encryptionKey,
        ciphertextBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(plaintextBuffer);
    } catch (error) {
      throw new Error(
        'Decryption failed - data may be corrupted or passphrase is incorrect'
      );
    }
  }

  /**
   * Check if encryption key is initialized
   */
  isInitialized(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Get the salt used for key derivation
   */
  getSalt(): string | null {
    return this.salt;
  }

  /**
   * Clear encryption key from memory
   */
  clear(): void {
    this.encryptionKey = null;
    this.salt = null;
  }

  // Helper methods for base64 encoding/decoding

  private bufferToBase64(buffer: Uint8Array): string {
    return Buffer.from(buffer).toString('base64');
  }

  private base64ToBuffer(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}

/**
 * Singleton instance
 */
let cryptoManagerInstance: CryptoManager | null = null;

/**
 * Get or create singleton CryptoManager instance
 */
export function getCryptoManager(): CryptoManager {
  if (!cryptoManagerInstance) {
    cryptoManagerInstance = new CryptoManager();
  }
  return cryptoManagerInstance;
}

/**
 * Clear singleton instance
 */
export function clearCryptoManager(): void {
  if (cryptoManagerInstance) {
    cryptoManagerInstance.clear();
    cryptoManagerInstance = null;
  }
}
