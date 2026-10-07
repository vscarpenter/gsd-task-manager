#!/usr/bin/env node

/**
 * Stamps the build's cache version into an exported service worker.
 *
 * public/sw.js keeps a fixed placeholder, so a build never rewrites a tracked
 * file. scripts/build-static-export.sh runs this on out/sw.js after the export.
 * The version comes from .build-info.json (written by generate-build-info.cjs),
 * with package.json as the fallback, so every build rotates the cache key.
 *
 * It fails closed. A deployed worker that kept an old version would never
 * rotate its pages and runtime caches, so a missing placeholder or anything
 * but a release version (which must start with a digit) exits 1.
 */

const fs = require('fs');
const path = require('path');

const BUILD_INFO = path.join(__dirname, '..', '.build-info.json');
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const CACHE_VERSION_PLACEHOLDER = "const CACHE_VERSION = 'dev';";
// A release version starts with a digit, which also rules out the placeholder's 'dev'.
const VERSION_PATTERN = /^\d[0-9A-Za-z.+-]*$/;

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

function stampCacheVersion(source, version) {
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`Refusing to stamp an invalid cache version: ${JSON.stringify(version)}`);
  }
  if (!source.includes(CACHE_VERSION_PLACEHOLDER)) {
    throw new Error(`The worker has no CACHE_VERSION placeholder to stamp: ${CACHE_VERSION_PLACEHOLDER}`);
  }
  return source.replace(CACHE_VERSION_PLACEHOLDER, `const CACHE_VERSION = '${version}';`);
}

function main(target) {
  if (!target) {
    throw new Error('Usage: node scripts/update-sw-version.cjs <path to the exported sw.js>');
  }
  const version = resolveVersion();
  fs.writeFileSync(target, stampCacheVersion(fs.readFileSync(target, 'utf8'), version));
  console.log(`Service worker cache version stamped to ${version} in ${target}`);
}

module.exports = { CACHE_VERSION_PLACEHOLDER, stampCacheVersion };

if (require.main === module) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
