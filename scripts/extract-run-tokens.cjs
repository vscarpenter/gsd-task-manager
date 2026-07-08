"use strict";

const TOKEN_FIELDS = ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"];

// Sum every *_tokens field present in a claude usage object (robust to which exist).
function totalTokens(usage) {
  if (!usage || typeof usage !== "object") return 0;
  return TOKEN_FIELDS.reduce((sum, f) => sum + (Number(usage[f]) || 0), 0);
}

// The PR number the builder reported via its final `OPENED_PR=<n>` line, or null.
function parsePr(resultText) {
  if (typeof resultText !== "string") return null;
  const m = /OPENED_PR=(\d+)/.exec(resultText);
  return m ? Number(m[1]) : null;
}

// Extract { tokens, pr } from a `claude -p --output-format json` run (object or JSON string).
function extractRunTokens(json) {
  let obj = json;
  if (typeof json === "string") {
    try {
      obj = JSON.parse(json);
    } catch {
      return { tokens: 0, pr: null };
    }
  }
  if (!obj || typeof obj !== "object") return { tokens: 0, pr: null };
  return { tokens: totalTokens(obj.usage), pr: parsePr(obj.result) };
}

module.exports = { extractRunTokens, totalTokens, parsePr };

// CLI: read the claude JSON from stdin, print "<tokens> <pr|none>".
if (require.main === module) {
  let input = "";
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    const { tokens, pr } = extractRunTokens(input);
    process.stdout.write(`${tokens} ${pr == null ? "none" : pr}`);
  });
}
