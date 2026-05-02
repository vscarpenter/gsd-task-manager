export interface ParsedCapture {
  title: string;
  urgent: boolean;
  important: boolean;
  tags: string[];
}

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

const TAG_PATTERN = /(^|\s)#([a-z0-9_-]+)/gi;
const DOUBLE_BANG = /(^|\s)!!(\s|$)/g;
const SINGLE_BANG = /(^|\s)!(\s|$)/g;
const STAR = /(^|\s)\*(\s|$)/g;

export function parseCapture(input: string): ParsedCapture {
  let working = input;
  const tags: string[] = [];

  // Extract tags
  working = working.replace(TAG_PATTERN, (_match, lead: string, tag: string) => {
    tags.push(tag.toLowerCase());
    return lead;
  });

  let urgent = false;
  let important = false;

  // Check for !! (reset lastIndex to avoid state issues with g flag)
  DOUBLE_BANG.lastIndex = 0;
  if (DOUBLE_BANG.test(working)) {
    urgent = true;
    important = true;
    DOUBLE_BANG.lastIndex = 0;
    working = working.replace(DOUBLE_BANG, "$1$2");
  }

  // Check for single ! (reset lastIndex)
  SINGLE_BANG.lastIndex = 0;
  if (SINGLE_BANG.test(working)) {
    urgent = true;
    SINGLE_BANG.lastIndex = 0;
    working = working.replace(SINGLE_BANG, "$1$2");
  }

  // Check for * (reset lastIndex)
  STAR.lastIndex = 0;
  if (STAR.test(working)) {
    important = true;
    STAR.lastIndex = 0;
    working = working.replace(STAR, "$1$2");
  }

  // Collapse whitespace and trim
  const title = working.replace(/\s+/g, " ").trim();

  return { title, urgent, important, tags };
}
