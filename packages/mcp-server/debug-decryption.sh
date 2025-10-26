#!/bin/bash

# Debug script for v0.2.0 decryption issues

echo "🔍 GSD MCP Server v0.2.0 - Decryption Diagnostics"
echo "=================================================="
echo ""

# Configuration from your config
API_URL="https://gsd-sync-worker-production.vscarpenter.workers.dev"
AUTH_TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJGLWpfb1phbS1rVDVQSHdfYmRpcHh3IiwiZW1haWwiOiJ2c2NhcnBlbnRlckBnbWFpbC5jb20iLCJkZXZpY2VJZCI6IjlTYzZRX2ZfbWpfcGpoUmtETS12WmciLCJqdGkiOiJoWVdSQUxNRk80dzZBdnk3NHBTeldnIiwiaWF0IjoxNzYxNDQ2NjAyLCJleHAiOjE3NjIwNTE0MDJ9.g9BO-anyVFIuU4ZIciuhc-3QQwG8QvDrP-G06y4XjzM"
PASSPHRASE="12Bhosdina!@"

echo "1️⃣ Testing Worker Health"
echo "------------------------"
curl -s "$API_URL/health" | jq '.'
if [ $? -eq 0 ]; then
  echo "✅ Worker is responding"
else
  echo "❌ Worker health check failed"
  exit 1
fi
echo ""

echo "2️⃣ Testing Authentication"
echo "-------------------------"
SYNC_STATUS=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/sync/status")
echo "$SYNC_STATUS" | jq '.'
if echo "$SYNC_STATUS" | jq -e '.error' > /dev/null 2>&1; then
  echo "❌ Authentication failed - token may be expired"
  exit 1
else
  echo "✅ Authentication successful"
fi
echo ""

echo "3️⃣ Testing Encryption Salt Endpoint"
echo "------------------------------------"
SALT_RESPONSE=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$API_URL/api/auth/encryption-salt")
echo "$SALT_RESPONSE" | jq '.'
if echo "$SALT_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "❌ Failed to fetch encryption salt"
  exit 1
fi

SALT=$(echo "$SALT_RESPONSE" | jq -r '.encryptionSalt')
if [ "$SALT" = "null" ] || [ -z "$SALT" ]; then
  echo "❌ Encryption not set up for this account"
  echo "   Go to GSD app → Settings → Sync and complete encryption setup"
  exit 1
else
  echo "✅ Encryption salt retrieved (length: ${#SALT})"
fi
echo ""

echo "4️⃣ Testing Pull Endpoint (Get Tasks)"
echo "-------------------------------------"
PULL_RESPONSE=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "mcp-debug",
    "lastVectorClock": {},
    "limit": 10
  }' \
  "$API_URL/api/sync/pull")

echo "$PULL_RESPONSE" | jq '.'

if echo "$PULL_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "❌ Failed to pull tasks"
  exit 1
fi

TASK_COUNT=$(echo "$PULL_RESPONSE" | jq '.tasks | length')
echo ""
echo "📊 Task count in database: $TASK_COUNT"

if [ "$TASK_COUNT" -eq 0 ]; then
  echo "⚠️  No tasks found in database"
  echo ""
  echo "Possible reasons:"
  echo "  1. No tasks have been created and synced yet"
  echo "  2. All tasks were deleted"
  echo "  3. Sync hasn't completed yet"
  echo ""
  echo "Next steps:"
  echo "  • Open GSD app (https://gsd.vinny.dev)"
  echo "  • Create at least 1 task"
  echo "  • Go to Settings → Sync and trigger manual sync"
  echo "  • Wait 30 seconds and try again"
  exit 0
fi

echo "✅ Found $TASK_COUNT task(s) to decrypt"
echo ""

echo "5️⃣ Testing Decryption (First Task)"
echo "-----------------------------------"

# Get first task
FIRST_TASK=$(echo "$PULL_RESPONSE" | jq -r '.tasks[0]')
ENCRYPTED_BLOB=$(echo "$FIRST_TASK" | jq -r '.encryptedBlob')
NONCE=$(echo "$FIRST_TASK" | jq -r '.nonce')

echo "Encrypted blob length: ${#ENCRYPTED_BLOB}"
echo "Nonce length: ${#NONCE}"
echo ""

# Try to decrypt with Node.js using the crypto module
node <<EOF
import { webcrypto } from 'node:crypto';

const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH = 256;

async function testDecryption() {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Convert base64 to buffer
    function base64ToBuffer(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    // Derive key
    console.log('Deriving encryption key from passphrase...');
    const passphrase = '$PASSPHRASE';
    const salt = '$SALT';

    const passphraseBuffer = encoder.encode(passphrase);
    const saltBuffer = base64ToBuffer(salt);

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
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['decrypt']
    );

    console.log('✅ Key derived successfully');

    // Try to decrypt
    console.log('Attempting to decrypt first task...');
    const encryptedBlob = '$ENCRYPTED_BLOB';
    const nonce = '$NONCE';

    const ciphertextBuffer = base64ToBuffer(encryptedBlob);
    const nonceBuffer = base64ToBuffer(nonce);

    const plaintextBuffer = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonceBuffer, tagLength: 128 },
      key,
      ciphertextBuffer
    );

    const decrypted = decoder.decode(plaintextBuffer);
    const task = JSON.parse(decrypted);

    console.log('✅ Decryption successful!');
    console.log('');
    console.log('📝 Decrypted task:');
    console.log(JSON.stringify(task, null, 2));

  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    console.error('');
    console.error('Common causes:');
    console.error('  • Incorrect passphrase (case-sensitive!)');
    console.error('  • Passphrase was changed after tasks were encrypted');
    console.error('  • Database corruption');
    console.error('');
    console.error('Next steps:');
    console.error('  • Verify passphrase in GSD app Settings → Sync');
    console.error('  • If forgotten, reset encryption (requires re-sync all devices)');
  }
}

testDecryption();
EOF

echo ""
echo "=================================================="
echo "🔍 Diagnostics Complete"
echo ""
echo "If decryption failed above, the issue is likely:"
echo "  • Wrong passphrase - check GSD app Settings → Sync"
echo "  • Passphrase mismatch - tasks encrypted with different passphrase"
echo ""
echo "If decryption succeeded but Claude doesn't see tasks:"
echo "  • Check Claude Desktop logs for errors"
echo "  • Restart Claude Desktop (Cmd+Q and reopen)"
echo "  • Try asking: 'List all my tasks' or 'Use the list_tasks tool'"
