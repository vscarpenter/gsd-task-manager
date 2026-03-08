#!/usr/bin/env node

// Test if environment variables are set correctly
console.log('Environment Variable Test');
console.log('=========================\n');

const vars = {
  GSD_POCKETBASE_URL: process.env.GSD_POCKETBASE_URL,
  GSD_AUTH_TOKEN: process.env.GSD_AUTH_TOKEN,
};

console.log('GSD_POCKETBASE_URL:', vars.GSD_POCKETBASE_URL ? '✅ Set' : '❌ Missing');
console.log('GSD_AUTH_TOKEN:', vars.GSD_AUTH_TOKEN ? '✅ Set' : '❌ Missing');

console.log('\nValues:');
console.log('GSD_POCKETBASE_URL:', vars.GSD_POCKETBASE_URL || '(not set)');
console.log('GSD_AUTH_TOKEN:', vars.GSD_AUTH_TOKEN ? '***' : '(not set)');

const missing = Object.entries(vars).filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.log(`\n❌ Missing: ${missing.join(', ')}`);
  console.log('\nPossible fixes:');
  console.log('1. Verify claude_desktop_config.json has correct syntax');
  console.log('2. Completely quit Claude Desktop (Cmd+Q)');
  console.log('3. Wait 5 seconds');
  console.log('4. Reopen Claude Desktop');
  console.log('5. Check Claude Desktop logs for errors');
} else {
  console.log('\n✅ All environment variables are set correctly!');
}
