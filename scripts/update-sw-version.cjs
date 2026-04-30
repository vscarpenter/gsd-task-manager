#!/usr/bin/env node

/**
 * Updates the service worker cache version to match the current build version.
 * Called as part of the build process to ensure cache busting on deploys.
 *
 * Reads from .build-info.json (the per-build version produced by
 * generate-build-info.cjs) so every build rotates the cache key, even when
 * package.json hasn't been bumped. Falls back to package.json if build info
 * is missing (e.g. running this script standalone before a build).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const BUILD_INFO = path.join(__dirname, '..', '.build-info.json');
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const SW_FILE = path.join(__dirname, '..', 'public', 'sw.js');

function resolveVersion() {
  if (fs.existsSync(BUILD_INFO)) {
    try {
      const buildInfo = JSON.parse(fs.readFileSync(BUILD_INFO, 'utf8'));
      if (buildInfo.version) return buildInfo.version;
    } catch {
      console.warn('Failed to read .build-info.json, falling back to package.json');
    }
  }
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  return packageJson.version || '0.0.0';
}

const version = resolveVersion();

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
