#!/usr/bin/env node

// Test if environment variables are set correctly
console.log('Environment Variable Test');
console.log('=========================\n');

const vars = {
  GSD_SUPABASE_URL: process.env.GSD_SUPABASE_URL,
  GSD_SUPABASE_SERVICE_KEY: process.env.GSD_SUPABASE_SERVICE_KEY,
  GSD_USER_EMAIL: process.env.GSD_USER_EMAIL,
  GSD_ENCRYPTION_PASSPHRASE: process.env.GSD_ENCRYPTION_PASSPHRASE,
};

console.log('GSD_SUPABASE_URL:', vars.GSD_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('GSD_SUPABASE_SERVICE_KEY:', vars.GSD_SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');
console.log('GSD_USER_EMAIL:', vars.GSD_USER_EMAIL ? '✅ Set' : '❌ Missing');
console.log('GSD_ENCRYPTION_PASSPHRASE:', vars.GSD_ENCRYPTION_PASSPHRASE ? '✅ Set' : '❌ Missing');

console.log('\nValues:');
console.log('GSD_SUPABASE_URL:', vars.GSD_SUPABASE_URL || '(not set)');
console.log('GSD_SUPABASE_SERVICE_KEY:', vars.GSD_SUPABASE_SERVICE_KEY ? `${vars.GSD_SUPABASE_SERVICE_KEY.substring(0, 20)}...` : '(not set)');
console.log('GSD_USER_EMAIL:', vars.GSD_USER_EMAIL || '(not set)');
console.log('GSD_ENCRYPTION_PASSPHRASE:', vars.GSD_ENCRYPTION_PASSPHRASE ? '✅ (set)' : '(not set)');

const missing = Object.entries(vars).filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.log(`\n❌ Missing variables: ${missing.join(', ')}`);
  console.log('\nPossible fixes:');
  console.log('1. Verify claude_desktop_config.json has correct syntax');
  console.log('2. Completely quit Claude Desktop (Cmd+Q)');
  console.log('3. Wait 5 seconds');
  console.log('4. Reopen Claude Desktop');
  console.log('5. Check Claude Desktop logs for errors');
} else {
  console.log('\n✅ All environment variables are set correctly!');
}
