import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readWorkflow(path: string): string {
  return readFileSync(path, "utf8");
}

describe("pipeline workflows", () => {
  it("evaluates release readiness from the latest check run per name", () => {
    const workflow = readWorkflow(".github/workflows/release-ready.yml");
    const listChecksIndex = workflow.indexOf("checks.listForRef");
    const dedupeIndex = workflow.indexOf(
      "if (!byName[c.name] || c.id > byName[c.name].id) byName[c.name] = c;"
    );
    const ciGreenIndex = workflow.indexOf(
      'const ciGreen = REQUIRED.every((n) => byName[n]?.conclusion === "success");'
    );
    const reviewerRanIndex = workflow.indexOf(
      'const reviewerRan = Object.entries(byName).some(([n, c]) => /claude.?review/i.test(n) && c.status === "completed");'
    );

    expect(listChecksIndex).toBeGreaterThan(-1);
    expect(dedupeIndex).toBeGreaterThan(listChecksIndex);
    expect(ciGreenIndex).toBeGreaterThan(dedupeIndex);
    expect(reviewerRanIndex).toBeGreaterThan(dedupeIndex);
  });

  it("keeps release-ready labels and marker comments synced after regressions", () => {
    const workflow = readWorkflow(".github/workflows/release-ready.yml");
    const notReadyLabelIndex = workflow.indexOf("} else if (!ready && hasLabel) {");
    const removeLabelIndex = workflow.indexOf(
      'removeLabel({ ...context.repo, issue_number: number, name: "release-ready" })',
      notReadyLabelIndex
    );
    const notReadyBodyIndex = workflow.indexOf(
      "⏳ **Not release-ready yet**",
      removeLabelIndex
    );
    const existingCommentIndex = workflow.indexOf(
      "const existing = comments.find((c) => c.body?.includes(MARKER));",
      notReadyBodyIndex
    );
    const updateCommentIndex = workflow.indexOf(
      "issues.updateComment",
      existingCommentIndex
    );
    const createReadyCommentIndex = workflow.indexOf(
      "} else if (ready) {",
      updateCommentIndex
    );

    expect(notReadyLabelIndex).toBeGreaterThan(-1);
    expect(removeLabelIndex).toBeGreaterThan(notReadyLabelIndex);
    expect(notReadyBodyIndex).toBeGreaterThan(removeLabelIndex);
    expect(existingCommentIndex).toBeGreaterThan(notReadyBodyIndex);
    expect(updateCommentIndex).toBeGreaterThan(existingCommentIndex);
    expect(createReadyCommentIndex).toBeGreaterThan(updateCommentIndex);
  });

  it("reconciles risk labels instead of accumulating stale tiers", () => {
    const workflow = readWorkflow(".github/workflows/apply-risk-label.yml");
    const invalidTierIndex = workflow.indexOf("if (!tier) {");
    const returnIndex = workflow.indexOf("return;", invalidTierIndex);
    const listLabelsIndex = workflow.indexOf("issues.listLabelsOnIssue");
    const currentRiskLabelsIndex = workflow.indexOf(
      'filter((n) => n.startsWith("risk:"))',
      listLabelsIndex
    );
    const alreadyCorrectIndex = workflow.indexOf(
      "riskLabels.length === 1 && riskLabels[0] === target",
      currentRiskLabelsIndex
    );
    const removeStaleIndex = workflow.indexOf(
      "issues\n                  .removeLabel",
      alreadyCorrectIndex
    );
    const ignoreMissingIndex = workflow.indexOf(
      "if (e.status !== 404) throw e;",
      removeStaleIndex
    );
    const addTargetIndex = workflow.indexOf(
      "issues.addLabels",
      ignoreMissingIndex
    );

    expect(invalidTierIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(invalidTierIndex);
    expect(listLabelsIndex).toBeGreaterThan(returnIndex);
    expect(currentRiskLabelsIndex).toBeGreaterThan(listLabelsIndex);
    expect(alreadyCorrectIndex).toBeGreaterThan(currentRiskLabelsIndex);
    expect(removeStaleIndex).toBeGreaterThan(alreadyCorrectIndex);
    expect(ignoreMissingIndex).toBeGreaterThan(removeStaleIndex);
    expect(addTargetIndex).toBeGreaterThan(ignoreMissingIndex);
  });
});
