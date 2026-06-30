#!/usr/bin/env node
/**
 * Publish a post to X (@GSDTaskManager) using OAuth 1.0a user-context creds.
 *
 * Reads post text from POST_TEXT or `--post-file <path>`. In dry-run mode it
 * never imports the SDK, never needs credentials, and never calls X. On a real
 * publish it posts to https://api.x.com/2/tweets via twitter-api-v2.
 *
 * Env:
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET  (required to publish)
 *   X_ACCOUNT_HANDLE   default 'GSDTaskManager' (for the result URL only)
 *   MAX_POST_CHARS     default 280
 *   DRY_RUN            publish only when exactly 'false'; anything else is a dry run
 * Args:
 *   --post-file <path> read the post text from a file
 *
 * Secrets are never logged. Error output is the SDK message/code only — never
 * credentials or token prefixes.
 */

import { readFileSync } from 'node:fs';
import { validatePostText } from './post-utils.mjs';

const REQUIRED_SECRETS = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function readPostText() {
  const file = getArg('--post-file');
  if (file) return readFileSync(file, 'utf8').replace(/\n+$/, '');
  if (process.env.POST_TEXT != null) return process.env.POST_TEXT;
  throw new Error('No post text: set POST_TEXT or pass --post-file <path>.');
}

function requireSecrets() {
  const missing = REQUIRED_SECRETS.filter((k) => !process.env[k]);
  if (missing.length) {
    // Names only — never values.
    throw new Error(`Missing required secrets: ${missing.join(', ')}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(err) {
  const code = err?.code ?? err?.status ?? err?.rateLimitError;
  return code === 429 || (typeof code === 'number' && code >= 500 && code < 600) || err?.rateLimitError === true;
}

/** Post the tweet with one short retry for transient 429/5xx responses. */
async function publishWithRetry(client, text) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await client.v2.tweet(text);
    } catch (err) {
      if (attempt === 0 && isTransient(err)) {
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new Error('publish failed');
}

async function main() {
  const maxChars = Number(process.env.MAX_POST_CHARS || '280');
  const handle = process.env.X_ACCOUNT_HANDLE || 'GSDTaskManager';
  const text = readPostText();

  validatePostText(text, maxChars);

  // Dry run short-circuits before requiring any credentials or importing the SDK.
  if (process.env.DRY_RUN !== 'false') {
    process.stdout.write(`${JSON.stringify({ ok: true, dry_run: true, length: text.length })}\n`);
    return;
  }

  requireSecrets();

  const { TwitterApi } = await import('twitter-api-v2');
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  const res = await publishWithRetry(client, text);
  const postId = res?.data?.id;
  if (!postId) throw new Error('X API returned no post id.');

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      post_id: postId,
      post_url: `https://x.com/${handle}/status/${postId}`,
    })}\n`
  );
}

main().catch((err) => {
  // Print the message/code only — never secrets.
  const code = err?.code ?? err?.status;
  const detail = code ? ` (code ${code})` : '';
  process.stderr.write(`post-to-x failed: ${err instanceof Error ? err.message : String(err)}${detail}\n`);
  process.exit(1);
});
