import { describe, it, expect } from "vitest";
import { isAgentBranch, isFailingCheck, failingAgentPRs } from "../scripts/failing-agent-prs.cjs";

const pr = (headRefName: string, checks: object[]) => ({ headRefName, statusCheckRollup: checks });

describe("isAgentBranch", () => {
  it.each([
    ["claude/fix-a", true],
    ["claude/issue-3-x", true],
    ["feat/x", false],
    ["", false],
  ])("%s -> %s", (name, expected) => expect(isAgentBranch(name as string)).toBe(expected));
  it("is false for non-strings", () => expect(isAgentBranch(undefined as unknown as string)).toBe(false));
});

describe("isFailingCheck", () => {
  it.each([
    [{ conclusion: "FAILURE" }, true],
    [{ conclusion: "TIMED_OUT" }, true],
    [{ conclusion: "ACTION_REQUIRED" }, true],
    [{ conclusion: "SUCCESS" }, false],
    [{ conclusion: null, status: "IN_PROGRESS" }, false],
    [{ state: "ERROR" }, true],
    [{ state: "FAILURE" }, true],
    [{ state: "SUCCESS" }, false],
    [{}, false],
  ])("%o -> %s", (check, expected) => expect(isFailingCheck(check)).toBe(expected));
  it("is false for null", () => expect(isFailingCheck(null)).toBe(false));
});

describe("failingAgentPRs", () => {
  it("includes an agent branch with a failing check", () => {
    expect(failingAgentPRs([pr("claude/fix-a", [{ conclusion: "FAILURE" }])])).toHaveLength(1);
  });
  it("excludes an agent branch whose checks all pass", () => {
    expect(failingAgentPRs([pr("claude/fix-a", [{ conclusion: "SUCCESS" }])])).toHaveLength(0);
  });
  it("excludes an agent branch with only pending checks", () => {
    expect(failingAgentPRs([pr("claude/fix-a", [{ conclusion: null, status: "QUEUED" }])])).toHaveLength(0);
  });
  it("excludes a NON-agent branch even if failing", () => {
    expect(failingAgentPRs([pr("feat/mine", [{ conclusion: "FAILURE" }])])).toHaveLength(0);
  });
  it("includes when any one check fails (mixed)", () => {
    expect(failingAgentPRs([pr("claude/fix-a", [{ conclusion: "SUCCESS" }, { state: "FAILURE" }])])).toHaveLength(1);
  });
  it("returns [] for empty/malformed input", () => {
    expect(failingAgentPRs([])).toEqual([]);
    expect(failingAgentPRs(null as unknown as object[])).toEqual([]);
  });
});
