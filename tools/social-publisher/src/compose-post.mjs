#!/usr/bin/env node
/**
 * Compose the draft X post for a release or a manual dispatch, then write it to
 * a file (for the publish job), echo it to stdout, and render a preview into
 * the GitHub Actions step summary.
 *
 * Never calls the X API. Reads the GitHub event JSON from GITHUB_EVENT_PATH.
 *
 * Env:
 *   GITHUB_EVENT_NAME    'release' | 'workflow_dispatch'
 *   GITHUB_EVENT_PATH    path to the event payload JSON
 *   APP_NAME             default 'GSD Task Manager'
 *   MAX_POST_CHARS       default 280
 *   GITHUB_STEP_SUMMARY  (optional) summary file to append a preview to
 *   GITHUB_OUTPUT        (optional) outputs file (writes length, dry_run, publishable)
 * Args:
 *   --out <file>         write the composed post text to <file>
 */

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { composeReleasePost, validatePostText } from './post-utils.mjs';

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function readEvent() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) throw new Error('GITHUB_EVENT_PATH is not set.');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Build the post for a release event. */
function composeForRelease(event, appName, maxChars) {
  const release = event.release || {};
  return composeReleasePost({
    appName,
    version: release.tag_name || release.name || '',
    releaseName: release.name || release.tag_name || '',
    releaseBody: release.body || '',
    releaseUrl: release.html_url || '',
    maxChars,
  });
}

/** Build the post for a manual dispatch. Returns { text, publishable }. */
function composeForDispatch(event, appName, maxChars) {
  const inputs = event.inputs || {};
  const manual = (inputs.post_text || '').trim();

  if (!manual) {
    // No text supplied: a harmless sample that must never be published.
    const text = `${appName} — social publishing dry run. No manual post_text was supplied, so nothing will be published.`;
    return { text, publishable: false };
  }

  let text = manual;
  const releaseUrl = (inputs.release_url || '').trim();
  if (releaseUrl && !text.includes(releaseUrl)) {
    const withUrl = `${text}\n\n${releaseUrl}`;
    if (withUrl.length <= maxChars) text = withUrl;
  }
  validatePostText(text, maxChars);
  return { text, publishable: true };
}

function writeOutputs({ length, dryRun, publishable }) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  appendFileSync(out, `length=${length}\ndry_run=${dryRun}\npublishable=${publishable}\n`);
}

function writeSummary({ text, length, maxChars, dryRun }) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  const handle = process.env.X_ACCOUNT_HANDLE || 'GSDTaskManager';
  const block = [
    `## Draft X Post for @${handle}`,
    '',
    '```text',
    text,
    '```',
    '',
    `Length: ${length} / ${maxChars} characters`,
    `Dry run: ${dryRun}`,
    '',
  ].join('\n');
  appendFileSync(summary, block);
}

function main() {
  const appName = process.env.APP_NAME || 'GSD Task Manager';
  const maxChars = Number(process.env.MAX_POST_CHARS || '280');
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const event = readEvent();

  let text;
  let publishable;
  let dryRun;

  if (eventName === 'release' || event.release) {
    text = composeForRelease(event, appName, maxChars);
    publishable = true;
    dryRun = false;
  } else if (eventName === 'workflow_dispatch' || event.inputs) {
    const result = composeForDispatch(event, appName, maxChars);
    text = result.text;
    publishable = result.publishable;
    const requested = (event.inputs || {}).dry_run;
    dryRun = requested !== 'false' || !publishable;
  } else {
    throw new Error(`Unsupported event: ${eventName || '(unknown)'}`);
  }

  validatePostText(text, maxChars);

  const outFile = getArg('--out');
  if (outFile) writeFileSync(outFile, text);
  process.stdout.write(`${text}\n`);

  writeSummary({ text, length: text.length, maxChars, dryRun });
  writeOutputs({ length: text.length, dryRun, publishable });
}

try {
  main();
} catch (err) {
  process.stderr.write(`compose-post failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
