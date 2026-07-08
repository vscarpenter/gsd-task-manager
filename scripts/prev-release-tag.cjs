"use strict";

// Match a plain vMAJOR.MINOR.PATCH release tag (no pre-release/build metadata).
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

function parse(v) {
  const m = SEMVER.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * The highest v*.*.* tag strictly less than currentVersion (numeric semver),
 * returned exactly as it appears in `tags` (e.g. "v9.3.2"), or null if none.
 * Malformed and pre-release tags are ignored.
 *
 * @param {string} currentVersion  e.g. "9.4.0" or "v9.4.0"
 * @param {string[]} tags
 * @returns {string|null}
 */
function prevReleaseTag(currentVersion, tags) {
  const cur = parse(currentVersion);
  if (!cur || !Array.isArray(tags)) return null;
  let best = null;
  let bestParsed = null;
  for (const tag of tags) {
    const p = parse(tag);
    if (!p || cmp(p, cur) >= 0) continue;
    if (!bestParsed || cmp(p, bestParsed) > 0) {
      best = String(tag).trim();
      bestParsed = p;
    }
  }
  return best;
}

module.exports = { prevReleaseTag };
