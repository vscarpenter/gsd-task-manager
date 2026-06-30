/**
 * Pure helpers for composing GSD Task Manager X posts from GitHub Release data.
 *
 * No I/O, no network, no secrets — every function here is deterministic and
 * unit-tested. The CLIs (compose-post, post-to-x) wrap these with environment
 * reading and the X API call.
 */

/** Conventional-commit types we treat as user-facing. */
const USER_FACING_TYPES = new Set(['feat', 'fix', 'perf']);

/** Sections (in hand-written Keep-a-Changelog bodies) whose bullets are highlights. */
const KAC_SECTION = /^#{2,3}\s+(added|changed|improved|fixed|what changed|changes)\s*$/i;

const MAX_HIGHLIGHTS = 3;

const GENERIC_BODY =
  'This release includes small improvements and fixes to make the task flow smoother.';

/** Match a leading conventional-commit prefix: `type(scope)!: `. */
const CONVENTIONAL_PREFIX = /^(\w+)(?:\(([^)]*)\))?!?:\s+/;

/**
 * Clean a raw bullet/PR title into a short, human highlight: drop the
 * GitHub "by @user in <url>" suffix, the conventional-commit prefix, markdown
 * links, trailing PR numbers, and a single trailing period; capitalize.
 */
export function normalizeHighlight(text) {
  let out = String(text ?? '').trim();
  // GitHub auto-format suffix: " by @user[bot] in https://…"
  out = out.replace(/\s+by\s+@[\w-]+(?:\[bot\])?\s+in\s+https?:\/\/\S+\s*$/i, '');
  // Conventional-commit prefix.
  out = out.replace(CONVENTIONAL_PREFIX, '');
  // Markdown links: [text](url) -> text
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Trailing PR/issue number: " (#123)" or " #123"
  out = out.replace(/\s*\(#\d+\)\s*$/, '').replace(/\s+#\d+\s*$/, '');
  // Collapse whitespace, trim, drop one trailing period.
  out = out.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  if (!out) return '';
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Classify a raw bullet's conventional type as user-facing, or null to drop. */
function isUserFacingPrTitle(raw) {
  const stripped = raw.replace(/\s+by\s+@[\w-]+(?:\[bot\])?\s+in\s+https?:\/\/\S+\s*$/i, '');
  const m = stripped.match(CONVENTIONAL_PREFIX);
  if (!m) return false; // GitHub-list bullets without a known type are dropped as noise.
  const type = m[1].toLowerCase();
  const scope = (m[2] || '').toLowerCase();
  if (scope.includes('deps')) return false;
  return USER_FACING_TYPES.has(type);
}

/** Collect raw bullet contents from lines like "- x" / "* x". */
function bulletLines(lines) {
  const out = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Collect bullets that sit under a Keep-a-Changelog highlight section. */
function kacSectionBullets(lines) {
  const out = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      inSection = KAC_SECTION.test(line);
      continue;
    }
    if (inSection) {
      const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

/**
 * Extract up to 3 user-facing highlights from a release body. Handles both
 * GitHub auto-generated "What's Changed" PR lists (keep feat/fix/perf, drop the
 * rest) and hand-written `### Added`/`### Fixed` sections (keep their bullets).
 */
export function extractHighlights(releaseBody) {
  const body = String(releaseBody ?? '');
  if (!body.trim()) return [];
  const lines = body.split(/\r?\n/);

  const hasKac = lines.some((l) => KAC_SECTION.test(l));
  const raw = hasKac ? kacSectionBullets(lines) : bulletLines(lines).filter(isUserFacingPrTitle);

  const seen = new Set();
  const highlights = [];
  for (const item of raw) {
    const h = normalizeHighlight(item);
    if (!h || seen.has(h.toLowerCase())) continue;
    seen.add(h.toLowerCase());
    highlights.push(h);
    if (highlights.length >= MAX_HIGHLIGHTS) break;
  }
  return highlights;
}

/** Return the curated subtitle after an em-dash / " - " in a release title, else null. */
export function parseReleaseSubtitle(releaseName) {
  const name = String(releaseName ?? '');
  const m = name.match(/\s+(?:—|–|-)\s+(.+)$/);
  return m ? m[1].trim() : null;
}

function buildPost(appName, version, bodyBlock, releaseUrl) {
  return `${appName} ${version} is out.\n\n${bodyBlock}\n\nRelease notes:\n${releaseUrl}`;
}

function bulletBlock(highlights) {
  return ['New in this release:', ...highlights.map((h) => `• ${h}`)].join('\n');
}

/**
 * Compose the release post. Body precedence: user-facing highlights → release
 * subtitle → generic line. Shrinks by dropping trailing bullets to fit
 * maxChars; throws if even the minimal form is too long (caller should then
 * require a manual post_text override).
 */
export function composeReleasePost({ appName, version, releaseName, releaseBody, releaseUrl, maxChars }) {
  const highlights = extractHighlights(releaseBody || '');
  const subtitle = parseReleaseSubtitle(releaseName || '');

  for (let n = highlights.length; n >= 1; n -= 1) {
    const post = buildPost(appName, version, bulletBlock(highlights.slice(0, n)), releaseUrl);
    if (post.length <= maxChars) return post;
  }

  if (subtitle) {
    const post = buildPost(appName, version, `This release focuses on ${subtitle}.`, releaseUrl);
    if (post.length <= maxChars) return post;
  }

  const generic = buildPost(appName, version, GENERIC_BODY, releaseUrl);
  if (generic.length <= maxChars) return generic;

  throw new Error(
    `Composed post exceeds ${maxChars} characters even at minimal form; supply a manual post_text override.`
  );
}

/** Throw if the post text is empty/whitespace or longer than maxChars. */
export function validatePostText(text, maxChars) {
  if (!text || !String(text).trim()) {
    throw new Error('Post text is empty.');
  }
  if (String(text).length > maxChars) {
    throw new Error(`Post text exceeds ${maxChars} characters (${String(text).length}).`);
  }
}
