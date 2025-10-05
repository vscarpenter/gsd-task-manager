#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BUILD_INFO_FILE = path.join(__dirname, '..', '.build-info.json');

// Read or initialize build info
let buildInfo = { buildNumber: 0 };
if (fs.existsSync(BUILD_INFO_FILE)) {
  try {
    buildInfo = JSON.parse(fs.readFileSync(BUILD_INFO_FILE, 'utf8'));
  } catch (err) {
    console.warn('Failed to read build info, starting from 0');
  }
}

// Increment build number
buildInfo.buildNumber += 1;

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
const envContent = `export NEXT_PUBLIC_BUILD_NUMBER=${buildInfo.buildNumber}\nexport NEXT_PUBLIC_BUILD_DATE="${buildInfo.buildDate}"\n`;
fs.writeFileSync(envFile, envContent);

console.log(`Build ${buildInfo.buildNumber} generated for ${buildInfo.buildDate}`);
