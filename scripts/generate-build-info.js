#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const BUILD_INFO_FILE = path.join(__dirname, '..', '.build-info.json');

// Read package.json to get base version
const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
const baseVersion = packageJson.version || '0.1.0';

// Read or initialize build info
let buildInfo = { version: baseVersion };
if (fs.existsSync(BUILD_INFO_FILE)) {
  try {
    buildInfo = JSON.parse(fs.readFileSync(BUILD_INFO_FILE, 'utf8'));
  } catch {
    console.warn('Failed to read build info, using package.json version');
  }
}

// If the base version in package.json changed, reset to that version
// Otherwise, increment the patch number
let newVersion;
if (buildInfo.version !== baseVersion) {
  newVersion = baseVersion;
} else {
  const [currentMajor, currentMinor, currentPatch] = buildInfo.version.split('.').map(Number);
  newVersion = `${currentMajor}.${currentMinor}.${currentPatch + 1}`;
}

buildInfo.version = newVersion;

// Generate friendly date format: "Jan 5, 2025 at 2:30 PM"
const now = new Date();
const options = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
};
const formattedDate = now.toLocaleString('en-US', options).replace(',', ' at');

buildInfo.buildDate = formattedDate;
buildInfo.timestamp = now.toISOString();

// Save build info
fs.writeFileSync(BUILD_INFO_FILE, JSON.stringify(buildInfo, null, 2));

// Write environment variables to a sourceable file
const envFile = path.join(__dirname, '..', '.build-env.sh');
const envContent = `export NEXT_PUBLIC_BUILD_NUMBER=${buildInfo.version}\nexport NEXT_PUBLIC_BUILD_DATE="${buildInfo.buildDate}"\n`;
fs.writeFileSync(envFile, envContent);

console.log(`Build ${buildInfo.version} generated for ${buildInfo.buildDate}`);
