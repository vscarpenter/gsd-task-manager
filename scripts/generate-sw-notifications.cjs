#!/usr/bin/env node
// Bundle the canonical reminder rules for classic importScripts(), without a runtime dependency.
const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

function generateSwNotifications(target) {
  const result = spawnSync('bun', ['build', 'lib/notifications/worker-entry.ts',
    '--target=browser', '--format=iife', `--outfile=${target}`], {
    cwd: resolve(__dirname, '..'), encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || 'Worker bundle failed');
  const header = '// GENERATED FILE. Do not edit by hand.\n// Run node scripts/generate-sw-notifications.cjs\n';
  writeFileSync(target, header + readFileSync(target, 'utf8'));
}

module.exports = { generateSwNotifications };
if (require.main === module) generateSwNotifications(resolve(__dirname, '../public/sw-notifications.js'));
