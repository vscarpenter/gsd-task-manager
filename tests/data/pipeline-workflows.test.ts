import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOW_DIR = ".github/workflows";
const RUN_SCRIPT_EXPRESSION =
  /\$\{\{\s*(?:vars|steps|inputs|github\.event)\.[^}]*\}\}/g;

function readWorkflow(path: string): string {
  return readFileSync(path, "utf8");
}

function listWorkflowPaths(): string[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => `${WORKFLOW_DIR}/${name}`);
}

// Checkout steps hold only scalar inputs, so splitting on list items keeps a
// checkout step's whole `with:` block inside one chunk.
function listItems(workflow: string): string[] {
  return workflow.split(/^[ \t]*- /m);
}

// Returns each `run:` value, including the indented body of a block scalar.
function runBlocks(workflow: string): string[] {
  const lines = workflow.split("\n");
  return lines.flatMap((line, index) => {
    const match = /^([ \t]*(?:- )?)run:(.*)$/.exec(line);
    if (!match) return [];
    const keyIndent = match[1].length;
    const bodyEnd = lines.findIndex(
      (next, nextIndex) =>
        nextIndex > index && next.trim() !== "" && next.search(/\S/) <= keyIndent
    );
    const body = lines.slice(index + 1, bodyEnd === -1 ? lines.length : bodyEnd);
    return [[match[2], ...body].join("\n")];
  });
}

describe("pipeline workflows", () => {
  it('only publishes Docker images from reviewed push and tag refs', () => {
    const workflow = readWorkflow('.github/workflows/publish-docker.yml');

    expect(workflow).toContain('push:');
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).not.toContain('dry_run');
    expect(workflow).not.toContain('github.event_name');
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

  it("sets persist-credentials explicitly on every checkout step", () => {
    const checkouts = listWorkflowPaths().flatMap((path) =>
      listItems(readWorkflow(path))
        .filter((item) => /uses:\s*actions\/checkout@/.test(item))
        .map((item) => ({ path, item }))
    );
    const implicitCheckouts = checkouts
      .filter(({ item }) => !/^[ \t]*persist-credentials:\s*(?:true|false)\b/m.test(item))
      .map(({ path }) => path);

    expect(checkouts.length).toBeGreaterThan(0);
    expect(implicitCheckouts).toEqual([]);
  });

  it("declares top-level permissions in every workflow", () => {
    const missing = listWorkflowPaths().filter(
      (path) => !/^permissions:/m.test(readWorkflow(path))
    );

    expect(missing).toEqual([]);
  });

  it("passes vars, step outputs, inputs, and event data to run scripts through env", () => {
    const blocks = listWorkflowPaths().flatMap((path) =>
      runBlocks(readWorkflow(path)).map((block) => ({ path, block }))
    );
    const interpolated = blocks.flatMap(({ path, block }) =>
      (block.match(RUN_SCRIPT_EXPRESSION) ?? []).map((expression) => `${path}: ${expression}`)
    );

    expect(blocks.length).toBeGreaterThan(0);
    expect(interpolated).toEqual([]);
  });
});
