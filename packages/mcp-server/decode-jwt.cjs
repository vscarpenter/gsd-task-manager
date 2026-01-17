#!/usr/bin/env node

// Get token from Claude Desktop config
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const configPath = path.join(
  process.env.HOME,
  'Library/Application Support/Claude/claude_desktop_config.json'
);

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const token = config.mcpServers['gsd-tasks'].env.GSD_AUTH_TOKEN;

// Decode JWT (just base64 decode, no verification)
const parts = token.split('.');
if (parts.length !== 3) {
  console.error('Invalid JWT format');
  process.exit(1);
}

const payload = Buffer.from(parts[1], 'base64').toString('utf8');
const decoded = JSON.parse(payload);

console.log('\n=== JWT Token Decoded ===\n');
console.log(JSON.stringify(decoded, null, 2));
console.log('\n=== Device ID ===');
console.log(decoded.deviceId || 'NOT FOUND');
console.log('\n=== User ID (sub) ===');
console.log(decoded.sub || 'NOT FOUND');
