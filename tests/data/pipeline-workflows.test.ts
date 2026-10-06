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

// Maps each job under `jobs:` to its body. Job keys sit at two-space indentation.
function jobBodies(workflow: string): Map<string, string> {
  const section = workflow.slice(workflow.indexOf("\njobs:\n") + "\njobs:\n".length);
  const parts = section.split(/^ {2}([a-z][\w-]*):\n/m).slice(1);
  const jobs = new Map<string, string>();
  for (let index = 0; index < parts.length; index += 2) jobs.set(parts[index], parts[index + 1]);
  return jobs;
}

const DEPLOY_AND_PUBLISH_WORKFLOWS = [
  "deploy-cloudfront-infra.yml",
  "deploy-production-release.yml",
  "publish-docker.yml",
  "publish-mcp-server.yml",
];

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

  // SEC-030: a High advisory in a runtime dependency must stop a deploy or
  // publish, not hide behind a job nobody waits for.
  it("runs the security audit before every deploy and publish job", () => {
    const audit = readWorkflow(`${WORKFLOW_DIR}/security-audit.yml`);
    expect(audit).toMatch(/^ {2}workflow_call:/m);

    for (const name of DEPLOY_AND_PUBLISH_WORKFLOWS) {
      const jobs = jobBodies(readWorkflow(`${WORKFLOW_DIR}/${name}`));
      // With `audit` as the only job that needs nothing, every other job waits
      // on it, directly or through a job that does.
      const rootJobs = [...jobs].filter(([, body]) => !/^ {4}needs:/m.test(body)).map(([job]) => job);

      expect(rootJobs, name).toEqual(["audit"]);
      expect(jobs.get("audit"), name).toMatch(/^ {4}uses: \.\/\.github\/workflows\/security-audit\.yml$/m);
    }
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
