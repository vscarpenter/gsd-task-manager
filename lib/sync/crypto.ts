/**
 * Client-side E2E encryption utilities
 * Uses Web Crypto API for secure encryption
 */

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation for client-side
const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';
const NONCE_LENGTH = 12; // 96 bits
const GCM_TAG_LENGTH = 128; // 128-bit authentication tag

/**
 * Encryption key manager
 * Derives encryption key from password and handles encryption/decryption
 */
export class CryptoManager {
  private encryptionKey: CryptoKey | null = null;
  private salt: string | null = null;

  /**
   * Derive encryption key from password and salt
   */
  async deriveKey(password: string, salt: string): Promise<void> {
    this.salt = salt;

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = this.base64ToBuffer(salt);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive encryption key using PBKDF2
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt plaintext data
   * Returns base64-encoded ciphertext, nonce, and auth tag
   */
  async encrypt(plaintext: string): Promise<{
    ciphertext: string;
    nonce: string;
  }> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized. Call deriveKey() first.');
    }

    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext);

    // Generate unique nonce (96 bits)
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

    // Encrypt with AES-256-GCM (includes authentication tag)
    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: nonce,
        tagLength: GCM_TAG_LENGTH,
      },
      this.encryptionKey,
      plaintextBuffer
    );

    return {
      ciphertext: this.bufferToBase64(new Uint8Array(ciphertextBuffer)),
      nonce: this.bufferToBase64(nonce),
    };
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
      const plaintextBuffer = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv: nonceBuffer,
          tagLength: GCM_TAG_LENGTH,
        },
        this.encryptionKey,
        ciphertextBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(plaintextBuffer);
    } catch {
      throw new Error('Decryption failed - data may be corrupted or key is incorrect');
    }
  }

  /**
   * Hash data with SHA-256
   * Used for checksums and integrity verification
   */
  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.bufferToBase64(new Uint8Array(hashBuffer));
  }

  /**
   * Hash password for transmission to server
   * Server will hash this again with server-side salt
   */
  async hashPassword(password: string): Promise<string> {
    // Simple client-side hash to avoid sending plaintext password
    return this.hash(password);
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
   * Clear encryption key from memory (for logout)
   */
  clear(): void {
    this.encryptionKey = null;
    this.salt = null;
  }

  // Helper methods for base64 encoding/decoding

  private bufferToBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer));
  }

  private base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes as Uint8Array<ArrayBuffer>;
  }
}

// Singleton instance
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
 * Clear singleton instance (for logout)
 */
export function clearCryptoManager(): void {
  if (cryptoManagerInstance) {
    cryptoManagerInstance.clear();
    cryptoManagerInstance = null;
  }
}

/**
 * Generate a new salt for encryption passphrase
 */
export function generateEncryptionSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Store encryption key and salt in IndexedDB
 * Key is exported as JWK and stored securely (IndexedDB only, never sent to server)
 */
export async function storeEncryptionConfig(
  passphrase: string,
  salt: Uint8Array
): Promise<void> {
  const { getDb } = await import('@/lib/db');
  const db = await getDb();

  // Derive encryption key from passphrase
  const cryptoManager = getCryptoManager();
  const saltBase64 = btoa(String.fromCharCode(...salt));
  await cryptoManager.deriveKey(passphrase, saltBase64);

  // Store salt in sync metadata (we need it for future key derivations)
  await db.syncMetadata.put({
    key: 'encryption_salt',
    value: { salt: Array.from(salt) },
  });
}

/**
 * Retrieve stored encryption salt from IndexedDB
 */
export async function getStoredEncryptionSalt(): Promise<Uint8Array | null> {
  const { getDb } = await import('@/lib/db');
  const db = await getDb();

  const config = await db.syncMetadata.get('encryption_salt');
  if (!config || config.key !== 'encryption_salt' || !config.value?.salt) return null;

  return new Uint8Array(config.value.salt);
}

/**
 * Initialize encryption key from stored salt and user-provided passphrase
 * Call this after OAuth login to decrypt synced data
 */
export async function initializeEncryptionFromPassphrase(
  passphrase: string
): Promise<boolean> {
  const salt = await getStoredEncryptionSalt();
  if (!salt) {
    return false; // No encryption setup yet
  }

  const cryptoManager = getCryptoManager();
  const saltBase64 = btoa(String.fromCharCode(...salt));
  await cryptoManager.deriveKey(passphrase, saltBase64);

  return true;
}

/**
 * Check if encryption has been set up (salt exists in IndexedDB)
 */
export async function isEncryptionConfigured(): Promise<boolean> {
  const salt = await getStoredEncryptionSalt();
  return salt !== null;
}
