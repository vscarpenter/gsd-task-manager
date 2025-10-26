#!/usr/bin/env node

// Test if environment variables are set correctly
console.log('Environment Variable Test');
console.log('=========================\n');

const vars = {
  GSD_API_URL: process.env.GSD_API_URL,
  GSD_AUTH_TOKEN: process.env.GSD_AUTH_TOKEN,
  GSD_ENCRYPTION_PASSPHRASE: process.env.GSD_ENCRYPTION_PASSPHRASE,
};

console.log('GSD_API_URL:', vars.GSD_API_URL ? '✅ Set' : '❌ Missing');
console.log('GSD_AUTH_TOKEN:', vars.GSD_AUTH_TOKEN ? '✅ Set' : '❌ Missing');
console.log('GSD_ENCRYPTION_PASSPHRASE:', vars.GSD_ENCRYPTION_PASSPHRASE ? '✅ Set' : '❌ Missing');

console.log('\nValues:');
console.log('GSD_API_URL:', vars.GSD_API_URL || '(not set)');
console.log('GSD_AUTH_TOKEN:', vars.GSD_AUTH_TOKEN ? `${vars.GSD_AUTH_TOKEN.substring(0, 20)}...` : '(not set)');
console.log('GSD_ENCRYPTION_PASSPHRASE:', vars.GSD_ENCRYPTION_PASSPHRASE || '(not set)');

if (!vars.GSD_ENCRYPTION_PASSPHRASE) {
  console.log('\n❌ GSD_ENCRYPTION_PASSPHRASE is not set!');
  console.log('\nThis means Claude Desktop is not passing the environment variable.');
  console.log('\nPossible fixes:');
  console.log('1. Verify claude_desktop_config.json has correct syntax');
  console.log('2. Completely quit Claude Desktop (Cmd+Q)');
  console.log('3. Wait 5 seconds');
  console.log('4. Reopen Claude Desktop');
  console.log('5. Check Claude Desktop logs for errors');
} else {
  console.log('\n✅ All environment variables are set correctly!');
}
