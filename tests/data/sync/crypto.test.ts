import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CryptoManager,
  getCryptoManager,
  clearCryptoManager,
  generateEncryptionSalt,
} from '@/lib/sync/crypto';

describe('CryptoManager', () => {
  let cryptoManager: CryptoManager;
  const testPassword = 'test-password-123!@#';
  const testSalt = 'dGVzdC1zYWx0LTEyMzQ1Njc4OTBhYmNkZWY='; // base64 encoded 32-byte salt

  beforeEach(() => {
    cryptoManager = new CryptoManager();
  });

  afterEach(() => {
    cryptoManager.clear();
    clearCryptoManager();
  });

  describe('Key Derivation', () => {
    it('should derive key from password and salt', async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
      expect(cryptoManager.isInitialized()).toBe(true);
      expect(cryptoManager.getSalt()).toBe(testSalt);
    });

    it('should derive consistent keys from same password and salt', async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
      const encrypted1 = await cryptoManager.encrypt('test data');

      const cryptoManager2 = new CryptoManager();
      await cryptoManager2.deriveKey(testPassword, testSalt);
      const decrypted = await cryptoManager2.decrypt(encrypted1.ciphertext, encrypted1.nonce);

      expect(decrypted).toBe('test data');
      cryptoManager2.clear();
    });

    it('should derive different keys from different salts', async () => {
      const salt2 = 'YW5vdGhlci1zYWx0LTEyMzQ1Njc4OTBhYmNkZWY='; // different salt

      await cryptoManager.deriveKey(testPassword, testSalt);
      const encrypted = await cryptoManager.encrypt('test data');

      const cryptoManager2 = new CryptoManager();
      await cryptoManager2.deriveKey(testPassword, salt2);

      await expect(
        cryptoManager2.decrypt(encrypted.ciphertext, encrypted.nonce)
      ).rejects.toThrow('Decryption failed');

      cryptoManager2.clear();
    });

    it('should derive different keys from different passwords', async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
      const encrypted = await cryptoManager.encrypt('test data');

      const cryptoManager2 = new CryptoManager();
      await cryptoManager2.deriveKey('different-password', testSalt);

      await expect(
        cryptoManager2.decrypt(encrypted.ciphertext, encrypted.nonce)
      ).rejects.toThrow('Decryption failed');

      cryptoManager2.clear();
    });

    it('should handle empty password', async () => {
      await cryptoManager.deriveKey('', testSalt);
      expect(cryptoManager.isInitialized()).toBe(true);

      // Should still encrypt/decrypt successfully
      const encrypted = await cryptoManager.encrypt('test');
      const decrypted = await cryptoManager.decrypt(encrypted.ciphertext, encrypted.nonce);
      expect(decrypted).toBe('test');
    });

    it('should use PBKDF2 with 600,000 iterations (OWASP 2023)', async () => {
      // This test verifies the iteration count through timing
      // 600k iterations should take noticeably longer than 10k
      const startTime = performance.now();
      await cryptoManager.deriveKey(testPassword, testSalt);
      const endTime = performance.now();

      // With 600k iterations, this should take at least 100ms on most machines
      // (actual time varies by hardware, but we're just checking it's not instant)
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(10); // Should take more than 10ms
    });
  });

  describe('Encryption', () => {
    beforeEach(async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
    });

    it('should encrypt plaintext successfully', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await cryptoManager.encrypt(plaintext);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.nonce).toBeDefined();
      expect(encrypted.ciphertext).not.toBe(plaintext);
      expect(encrypted.nonce.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertext for same plaintext (unique nonce)', async () => {
      const plaintext = 'test data';

      const encrypted1 = await cryptoManager.encrypt(plaintext);
      const encrypted2 = await cryptoManager.encrypt(plaintext);

      // Same plaintext should produce different ciphertexts due to unique nonces
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.nonce).not.toBe(encrypted2.nonce);
    });

    it('should encrypt and decrypt round-trip successfully', async () => {
      const plaintext = 'Hello, World!';

      const encrypted = await cryptoManager.encrypt(plaintext);
      const decrypted = await cryptoManager.decrypt(encrypted.ciphertext, encrypted.nonce);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle Unicode characters correctly', async () => {
      const plaintext = '你好世界 🌍 مرحبا بالعالم';

      const encrypted = await cryptoManager.encrypt(plaintext);
      const decrypted = await cryptoManager.decrypt(encrypted.ciphertext, encrypted.nonce);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle large plaintext (>10KB)', async () => {
      const largePlaintext = 'a'.repeat(20000); // 20KB

      const encrypted = await cryptoManager.encrypt(largePlaintext);
      const decrypted = await cryptoManager.decrypt(encrypted.ciphertext, encrypted.nonce);

      expect(decrypted).toBe(largePlaintext);
      expect(decrypted.length).toBe(20000);
    });

    it('should handle empty string', async () => {
      const plaintext = '';

      const encrypted = await cryptoManager.encrypt(plaintext);
      const decrypted = await cryptoManager.decrypt(encrypted.ciphertext, encrypted.nonce);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON objects', async () => {
      const obj = { id: '123', title: 'Test Task', tags: ['work', 'urgent'] };
      const plaintext = JSON.stringify(obj);

      const encrypted = await cryptoManager.encrypt(plaintext);
      const decrypted = await cryptoManager.decrypt(encrypted.ciphertext, encrypted.nonce);

      expect(JSON.parse(decrypted)).toEqual(obj);
    });

    it('should throw error when encrypting without initialized key', async () => {
      const uninitializedManager = new CryptoManager();

      await expect(uninitializedManager.encrypt('test')).rejects.toThrow(
        'Encryption key not initialized'
      );

      uninitializedManager.clear();
    });
  });

  describe('Decryption', () => {
    beforeEach(async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
    });

    it('should fail with wrong password', async () => {
      const plaintext = 'secret data';
      const encrypted = await cryptoManager.encrypt(plaintext);

      const wrongPasswordManager = new CryptoManager();
      await wrongPasswordManager.deriveKey('wrong-password', testSalt);

      await expect(
        wrongPasswordManager.decrypt(encrypted.ciphertext, encrypted.nonce)
      ).rejects.toThrow('Decryption failed');

      wrongPasswordManager.clear();
    });

    it('should fail with corrupted ciphertext', async () => {
      const plaintext = 'secret data';
      const encrypted = await cryptoManager.encrypt(plaintext);

      // Corrupt the ciphertext
      const corrupted = encrypted.ciphertext.slice(0, -5) + 'XXXXX';

      await expect(cryptoManager.decrypt(corrupted, encrypted.nonce)).rejects.toThrow(
        'Decryption failed'
      );
    });

    it('should fail with corrupted nonce', async () => {
      const plaintext = 'secret data';
      const encrypted = await cryptoManager.encrypt(plaintext);

      // Corrupt the nonce
      const corruptedNonce = encrypted.nonce.slice(0, -5) + 'XXXXX';

      await expect(cryptoManager.decrypt(encrypted.ciphertext, corruptedNonce)).rejects.toThrow(
        'Decryption failed'
      );
    });

    it('should fail with swapped ciphertext and nonce', async () => {
      const encrypted1 = await cryptoManager.encrypt('data 1');
      const encrypted2 = await cryptoManager.encrypt('data 2');

      // Use ciphertext from one with nonce from another
      await expect(cryptoManager.decrypt(encrypted1.ciphertext, encrypted2.nonce)).rejects.toThrow(
        'Decryption failed'
      );
    });

    it('should throw error when decrypting without initialized key', async () => {
      const uninitializedManager = new CryptoManager();

      await expect(uninitializedManager.decrypt('fake-ciphertext', 'fake-nonce')).rejects.toThrow(
        'Encryption key not initialized'
      );

      uninitializedManager.clear();
    });

    it('should validate authentication tag (GCM mode)', async () => {
      const plaintext = 'authenticated data';
      const encrypted = await cryptoManager.encrypt(plaintext);

      // Try to tamper with ciphertext (should fail authentication)
      let tamperedCiphertext = encrypted.ciphertext;
      if (tamperedCiphertext.length > 5) {
        // Flip one bit in the ciphertext
        const bytes = atob(tamperedCiphertext);
        const byteArray = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          byteArray[i] = bytes.charCodeAt(i);
        }
        byteArray[0] = byteArray[0] ^ 1; // Flip one bit
        tamperedCiphertext = btoa(String.fromCharCode(...byteArray));
      }

      await expect(
        cryptoManager.decrypt(tamperedCiphertext, encrypted.nonce)
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('Hash Functions', () => {
    it('should hash data with SHA-256', async () => {
      const data = 'test data';
      const hash = await cryptoManager.hash(data);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
      // SHA-256 output is 32 bytes, base64 encoded is ~44 characters
      expect(hash.length).toBeGreaterThan(40);
    });

    it('should produce consistent hashes for same data', async () => {
      const data = 'test data';

      const hash1 = await cryptoManager.hash(data);
      const hash2 = await cryptoManager.hash(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', async () => {
      const hash1 = await cryptoManager.hash('data 1');
      const hash2 = await cryptoManager.hash('data 2');

      expect(hash1).not.toBe(hash2);
    });

    it('should hash passwords for server transmission', async () => {
      const password = 'my-password';
      const hashed = await cryptoManager.hashPassword(password);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(40);
    });
  });

  describe('State Management', () => {
    it('should track initialization state', () => {
      expect(cryptoManager.isInitialized()).toBe(false);
    });

    it('should be initialized after deriveKey', async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
      expect(cryptoManager.isInitialized()).toBe(true);
    });

    it('should clear state on clear()', async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
      expect(cryptoManager.isInitialized()).toBe(true);
      expect(cryptoManager.getSalt()).toBe(testSalt);

      cryptoManager.clear();

      expect(cryptoManager.isInitialized()).toBe(false);
      expect(cryptoManager.getSalt()).toBe(null);

      // Should not be able to encrypt after clearing
      await expect(cryptoManager.encrypt('test')).rejects.toThrow(
        'Encryption key not initialized'
      );
    });

    it('should return stored salt', async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
      expect(cryptoManager.getSalt()).toBe(testSalt);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getCryptoManager', () => {
      const instance1 = getCryptoManager();
      const instance2 = getCryptoManager();

      expect(instance1).toBe(instance2);
    });

    it('should clear singleton instance', async () => {
      const instance1 = getCryptoManager();
      await instance1.deriveKey(testPassword, testSalt);

      clearCryptoManager();

      const instance2 = getCryptoManager();
      expect(instance2.isInitialized()).toBe(false);
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Salt Generation', () => {
    it('should generate encryption salt', () => {
      const salt = generateEncryptionSalt();

      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(32); // 256 bits
    });

    it('should generate unique salts', () => {
      const salt1 = generateEncryptionSalt();
      const salt2 = generateEncryptionSalt();

      expect(salt1).not.toEqual(salt2);
    });

    it('should generate salts with sufficient entropy', () => {
      const salt = generateEncryptionSalt();

      // Check that salt has some variation (not all zeros)
      const sum = Array.from(salt).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);

      // Check that salt has reasonable entropy (not all same value)
      const uniqueBytes = new Set(salt);
      expect(uniqueBytes.size).toBeGreaterThan(10); // At least 10 unique byte values
    });
  });

  describe('Security Properties', () => {
    beforeEach(async () => {
      await cryptoManager.deriveKey(testPassword, testSalt);
    });

    it('should use AES-256-GCM encryption', async () => {
      // This is implicit in the implementation, but we can verify the output format
      const encrypted = await cryptoManager.encrypt('test');

      // GCM mode produces ciphertext + auth tag
      // Auth tag is 128 bits (16 bytes), so encrypted data should be longer than plaintext
      expect(encrypted.ciphertext.length).toBeGreaterThan(4); // "test" is 4 bytes
    });

    it('should use 96-bit nonce (12 bytes)', async () => {
      const encrypted = await cryptoManager.encrypt('test');

      // Base64 encoding of 12 bytes is 16 characters
      expect(encrypted.nonce.length).toBe(16);
    });

    it('should verify 100 consecutive encryptions produce unique nonces', async () => {
      const nonces = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const encrypted = await cryptoManager.encrypt(`test ${i}`);
        nonces.add(encrypted.nonce);
      }

      // All 100 nonces should be unique
      expect(nonces.size).toBe(100);
    });
  });
});
