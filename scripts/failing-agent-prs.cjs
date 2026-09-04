"use strict";

const FAIL_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
]);
const FAIL_STATES = new Set(["failure", "error"]);

function isAgentBranch(headRefName) {
  return typeof headRefName === "string" && headRefName.startsWith("claude/");
}

function isValidHeadSha(headRefOid) {
  return typeof headRefOid === "string" && /^[0-9a-f]{40}$/i.test(headRefOid);
}

// Discovery is deliberately stricter than branch provenance. A same-repo
// branch is not trusted merely because a maintainer can create it: require the
// configured bot identity and an exact immutable head SHA. This still is not
// execution authorization; triage-run.sh is discovery-only.
function isTrustedProvenance(pr, botLogin) {
  if (!pr || typeof pr !== "object") return false;
  if (typeof botLogin !== "string" || botLogin.trim() === "") return false;
  if (pr.isCrossRepository !== false) return false;
  if (!isValidHeadSha(pr.headRefOid)) return false;
  const authorLogin = pr.author && pr.author.login;
  return (
    typeof authorLogin === "string" &&
    authorLogin.toLowerCase() === botLogin.trim().toLowerCase()
  );
}

function isFailingCheck(check) {
  if (!check || typeof check !== "object") return false;
  const conclusion = String(check.conclusion || "").toLowerCase();
  const state = String(check.state || "").toLowerCase();
  return FAIL_CONCLUSIONS.has(conclusion) || FAIL_STATES.has(state);
}

function failingAgentPRs(prs, botLogin) {
  if (!Array.isArray(prs)) return [];
  return prs.filter(
    (pr) =>
      pr &&
      isAgentBranch(pr.headRefName) &&
      isTrustedProvenance(pr, botLogin) &&
      Array.isArray(pr.statusCheckRollup) &&
      pr.statusCheckRollup.some(isFailingCheck)
  );
}

module.exports = {
  isAgentBranch,
  isValidHeadSha,
  isTrustedProvenance,
  isFailingCheck,
  failingAgentPRs,
};

if (require.main === module) {
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    try {
      const prs = JSON.parse(input);
      process.stdout.write(
        String(failingAgentPRs(prs, process.env.GSD_TRIAGE_BOT_LOGIN).length)
      );
    } catch {
      process.stdout.write("0");
    }
  });
}
