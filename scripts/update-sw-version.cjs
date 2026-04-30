#!/usr/bin/env node

/**
 * Updates the service worker cache version to match package.json version.
 * Called as part of the build process to ensure cache busting on deploys.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const SW_FILE = path.join(__dirname, '..', 'public', 'sw.js');

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
const version = packageJson.version || '0.0.0';

let swContent = fs.readFileSync(SW_FILE, 'utf8');

// Replace the CACHE_VERSION constant value
const versionPattern = /const CACHE_VERSION = '[^']+';/;
if (versionPattern.test(swContent)) {
  swContent = swContent.replace(versionPattern, `const CACHE_VERSION = '${version}';`);
  fs.writeFileSync(SW_FILE, swContent);
  console.log(`Service worker cache version updated to ${version}`);
} else {
  console.error('Could not find CACHE_VERSION in sw.js');
  process.exit(1);
}
