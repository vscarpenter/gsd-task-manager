"use strict";

const FAIL_CONCLUSIONS = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure"]);
const FAIL_STATES = new Set(["failure", "error"]);

function isAgentBranch(headRefName) {
  return typeof headRefName === "string" && headRefName.startsWith("claude/");
}

// A statusCheckRollup entry is failing if its CheckRun conclusion or its
// StatusContext state indicates failure. Pending/success/neutral/skipped are not.
function isFailingCheck(check) {
  if (!check || typeof check !== "object") return false;
  const conclusion = String(check.conclusion || "").toLowerCase();
  const state = String(check.state || "").toLowerCase();
  return FAIL_CONCLUSIONS.has(conclusion) || FAIL_STATES.has(state);
}

function failingAgentPRs(prs) {
  if (!Array.isArray(prs)) return [];
  return prs.filter(
    (pr) =>
      pr &&
      isAgentBranch(pr.headRefName) &&
      Array.isArray(pr.statusCheckRollup) &&
      pr.statusCheckRollup.some(isFailingCheck)
  );
}

module.exports = { isAgentBranch, isFailingCheck, failingAgentPRs };

// CLI: read `gh pr list --json number,headRefName,statusCheckRollup` from stdin,
// print the count of failing agent PRs. Fail-safe to 0 on bad input.
if (require.main === module) {
  let input = "";
  process.stdin.on("data", (c) => (input += c));
  process.stdin.on("end", () => {
    let prs = [];
    try {
      prs = JSON.parse(input);
    } catch {
      prs = [];
    }
    process.stdout.write(String(failingAgentPRs(prs).length));
  });
}
