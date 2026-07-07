"use strict";

// Canonical risk tiers, in escalation order. Must match the dropdown options
// in .github/ISSUE_TEMPLATE/change_request.yml exactly (bare lowercase words).
const RISK_TIERS = ["docs", "chore", "feature", "risky"];

/**
 * Extract the selected risk tier from a GitHub Issue Form body.
 * The form renders the dropdown as an "### Risk tier" heading followed by the
 * chosen option on the next non-empty line. Returns null for anything that is
 * not exactly one of RISK_TIERS (unanswered, junk, malformed, non-string).
 *
 * @param {string|null|undefined} body
 * @returns {"docs"|"chore"|"feature"|"risky"|null}
 */
function parseRiskTier(body) {
  if (typeof body !== "string" || body.length === 0) return null;
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const headingIdx = lines.findIndex((line) =>
    /^#{1,6}\s+Risk tier\s*$/i.test(line.trim())
  );
  if (headingIdx === -1) return null;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const value = lines[i].trim();
    if (value === "") continue;
    if (/^#{1,6}\s+/.test(value)) return null; // hit next heading = empty answer
    const normalized = value.toLowerCase();
    return RISK_TIERS.includes(normalized) ? normalized : null;
  }
  return null;
}

module.exports = { parseRiskTier, RISK_TIERS };
