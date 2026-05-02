// MIRROR OF lib/capture-parser.ts (extractUrlsFromTitle + buildDescription only).
// Keep this file in sync with the canonical webapp module. Drift is detected by
// packages/mcp-server/src/__tests__/text/capture-parser-parity.test.ts.
//
// The MCP server is published as a standalone npm package built with plain `tsc`.
// It cannot import from the webapp's lib/ tree because tsconfig.rootDir = "./src".
// Vendoring + parity test was chosen over introducing a bundler or a separate
// shared workspace package — see
// docs/superpowers/specs/2026-05-02-mcp-url-extraction-parity-design.md.

export interface ExtractedUrls {
  cleanTitle: string;
  urls: string[];
}

const FALLBACK_TITLE_FOR_URL_ONLY = "Review link below";

// Matches http/https URLs; reuses the same pattern as lib/task-links.ts
const TITLE_URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`{}|\\^]+/giu;
const TRAILING_PUNCTUATION = /[),.!?;:]+$/u;
const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function sanitizeTitleUrl(candidate: string): string | null {
  const value = candidate.trim();
  if (value.length === 0 || value.length > MAX_URL_LENGTH || /[\u0000-\u001F\u007F\s]/u.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.has(url.protocol.toLowerCase())) return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Scans `title` for http/https URLs, removes them, and returns the sanitized
 * URL list alongside the cleaned title text.
 *
 * Rules:
 * - All valid URLs are extracted and sanitized (XSS-safe: http/https only, no credentials).
 * - Invalid or unsafe URL candidates are left in the title unchanged.
 * - If the title collapses to empty after extraction, `cleanTitle` is set to
 *   FALLBACK_TITLE_FOR_URL_ONLY ("Review link below").
 */
export function extractUrlsFromTitle(title: string): ExtractedUrls {
  const urls: string[] = [];
  let working = title;

  // We build the cleaned title by iterating matches and replacing valid URLs.
  // Using a replacer lets us handle invalid candidates gracefully (leave them in place).
  working = working.replace(TITLE_URL_PATTERN, (raw) => {
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
    const safe = sanitizeTitleUrl(trimmed);
    if (!safe) return raw; // leave invalid/unsafe candidates untouched
    urls.push(safe);
    // Trailing punctuation (e.g. a period at the end of a sentence) is dropped
    // along with the URL — it was sentence-level punctuation around the link.
    return "";
  });

  const cleanTitle = working.replace(/\s+/g, " ").trim() || (urls.length > 0 ? FALLBACK_TITLE_FOR_URL_ONLY : "");

  return { cleanTitle, urls };
}

/**
 * Merges extracted URLs into an existing description, separated by newlines.
 * - If `urls` is empty, returns `existing` unchanged.
 * - If `existing` is empty/whitespace, returns the URL block alone.
 * - Otherwise returns `existing.trim() + "\n" + urls.join("\n")`.
 */
export function buildDescription(existing: string, urls: string[]): string {
  if (urls.length === 0) return existing;
  const urlBlock = urls.join("\n");
  return existing.trim() ? `${existing.trim()}\n${urlBlock}` : urlBlock;
}
