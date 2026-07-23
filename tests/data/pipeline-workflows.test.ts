import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readWorkflow(path: string): string {
  return readFileSync(path, "utf8");
}

describe("pipeline workflows", () => {
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
    const reconciliationBlock = workflow.slice(alreadyCorrectIndex);
    const removeStaleIndex = reconciliationBlock.search(
      /issues\s*\.\s*removeLabel/
    );
    const ignoreMissingIndex = reconciliationBlock.indexOf(
      "if (e.status !== 404) throw e;",
      removeStaleIndex
    );
    const addTargetIndex = reconciliationBlock.indexOf(
      "issues.addLabels",
      ignoreMissingIndex
    );

    expect(invalidTierIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(invalidTierIndex);
    expect(listLabelsIndex).toBeGreaterThan(returnIndex);
    expect(currentRiskLabelsIndex).toBeGreaterThan(listLabelsIndex);
    expect(alreadyCorrectIndex).toBeGreaterThan(currentRiskLabelsIndex);
    expect(removeStaleIndex).toBeGreaterThan(-1);
    expect(ignoreMissingIndex).toBeGreaterThan(removeStaleIndex);
    expect(addTargetIndex).toBeGreaterThan(ignoreMissingIndex);
  });
});
