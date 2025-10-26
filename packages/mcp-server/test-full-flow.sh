#!/bin/bash

echo "🔍 Testing Full Decryption Flow"
echo "================================"
echo ""

# Test with Node.js directly
node <<'EOF'
import { webcrypto } from 'node:crypto';

const PASSPHRASE = "12Bhosdina!@";
const SALT = "140,160,92,190,145,127,241,24,122,112,227,74,143,185,81,106,39,15,3,50,81,75,245,14,178,24,110,116,45,58,225,0";
const ENCRYPTED_BLOB = "yxu7Bn8+HR8f6omjFzcLTIb/YhqmQsb/BPUYN5dYqw+bHFycsvQhJT0pndBi42BQ6G2d1B9t3KFzui0GjcQd+vw3JVU7nRoRmvmFHZI9hpWOdz7/YvNplgmJ3zKLkT0NBx3glW+XLZLc0jEs0xLDjj+GlU+P/kdEb8NxJzyrZvY3KvlxBrbTJ85/hhpuIRmWqYGUzlDFYLxFVPYoqj2wd7IE2z0n+XrmC0I0wx85fPKvE3HpE/kRsuTv/UFCVqcu+GnfwKAZh8qQpbhZGxmMP/BP/WSMNerAJBW1jNTPAbYnZ5RTp/7y928GdFjF/oQ6PN0GzfxJAYJ0kabNeYGfS9ayzHBzy1mgLWSh2A/hZn/d8Q+BivOn8fdw8Iht0gC26Y5/6vtWw8TWx3mZTKmv23lN0gNKADQ/NNHAc7vNL4C4XR7cACcY4L0MBELaz3bHAmkCns6x45FdRBJRPM4bUox9YN3cAnPPwtlfBJS9qYbu5USBhKLUPT7eH16VzRzfaLlqGaDuC9LehAKagsdxocf9XOY6ggmmj+uI1/gGC37VMdAjiNq1V4g9JEUSgpe5SHhb2ghY2yzvMZC5MGvJ3SZ2uEZmMs6yBZxQ0y5cLlI1wxugGB+CRbnDr9nNtIPUAUXjfFKjqpkTeDbLdtSzKhwt0yAHWdkADojC06e6jC/WkqDWjOn0XQGTNFRBbynTXVFS2L8rS5T1aDkkUxMyVzHco2c=";
const NONCE = "m4WFC8hacQhPLuR5";

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert comma-separated salt to buffer
function saltArrayToBuffer(saltStr) {
  const numbers = saltStr.split(',').map(n => parseInt(n.trim()));
  return new Uint8Array(numbers);
}

async function testDecryption() {
  try {
    console.log('1️⃣ Deriving encryption key...');
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const passphraseBuffer = encoder.encode(PASSPHRASE);
    const saltBuffer = saltArrayToBuffer(SALT);

    const keyMaterial = await webcrypto.subtle.importKey(
      'raw',
      passphraseBuffer,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await webcrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 600000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    console.log('✅ Key derived successfully');

    console.log('2️⃣ Decrypting task...');
    const ciphertextBuffer = base64ToBuffer(ENCRYPTED_BLOB);
    const nonceBuffer = base64ToBuffer(NONCE);

    const plaintextBuffer = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonceBuffer, tagLength: 128 },
      key,
      ciphertextBuffer
    );

    const decrypted = decoder.decode(plaintextBuffer);
    const task = JSON.parse(decrypted);

    console.log('✅ Decryption successful!');
    console.log('');
    console.log('📝 Decrypted Task:');
    console.log(`   Title: ${task.title}`);
    console.log(`   Description: ${task.description}`);
    console.log(`   Quadrant: ${task.quadrantId}`);
    console.log(`   Completed: ${task.completed}`);
    console.log(`   Tags: ${task.tags.join(', ')}`);
    console.log('');
    console.log('🎉 Passphrase is correct and decryption works!');

  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    console.error('');
    console.error('This means:');
    console.error('  • Passphrase is incorrect, OR');
    console.error('  • Encryption format mismatch');
  }
}

testDecryption();
EOF
