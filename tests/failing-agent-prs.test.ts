import { describe, expect, it } from "vitest";
import {
  failingAgentPRs,
  isAgentBranch,
  isFailingCheck,
  isTrustedProvenance,
  isValidHeadSha,
} from "../scripts/failing-agent-prs.cjs";

const BOT = "claude[bot]";
const SHA = "a".repeat(40);

const pr = (
  headRefName: string,
  checks: object[],
  overrides: Record<string, unknown> = {}
) => ({
  author: { login: BOT },
  headRefName,
  headRefOid: SHA,
  isCrossRepository: false,
  statusCheckRollup: checks,
  ...overrides,
});

describe("agent PR identity", () => {
  it.each([
    ["claude/fix-a", true],
    ["feat/x", false],
    ["", false],
  ])("classifies branch %s", (name, expected) => {
    expect(isAgentBranch(name)).toBe(expected);
  });

  it("requires an exact 40-hex head SHA", () => {
    expect(isValidHeadSha(SHA)).toBe(true);
    expect(isValidHeadSha("abc")).toBe(false);
    expect(isValidHeadSha("z".repeat(40))).toBe(false);
    expect(isValidHeadSha(undefined)).toBe(false);
  });

  it("requires same-repo, configured bot authorship, and the head SHA", () => {
    expect(isTrustedProvenance(pr("claude/x", []), BOT)).toBe(true);
    expect(
      isTrustedProvenance(pr("claude/x", [], { author: { login: "vscarpenter" } }), BOT)
    ).toBe(false);
    expect(isTrustedProvenance(pr("claude/x", [], { isCrossRepository: true }), BOT)).toBe(false);
    expect(isTrustedProvenance(pr("claude/x", [], { headRefOid: "abc" }), BOT)).toBe(false);
    expect(isTrustedProvenance(pr("claude/x", []), "")).toBe(false);
  });
});

describe("failing checks", () => {
  it.each([
    [{ conclusion: "FAILURE" }, true],
    [{ conclusion: "TIMED_OUT" }, true],
    [{ state: "ERROR" }, true],
    [{ conclusion: "SUCCESS" }, false],
    [{ conclusion: null, status: "IN_PROGRESS" }, false],
    [null, false],
  ])("classifies %o", (check, expected) => {
    expect(isFailingCheck(check)).toBe(expected);
  });
});

describe("failingAgentPRs", () => {
  it("returns only failing bot-authored exact-SHA same-repo branches", () => {
    const candidates = [
      pr("claude/failing", [{ conclusion: "FAILURE" }]),
      pr("claude/passing", [{ conclusion: "SUCCESS" }]),
      pr("feat/failing", [{ conclusion: "FAILURE" }]),
      pr("claude/maintainer", [{ conclusion: "FAILURE" }], {
        author: { login: "vscarpenter" },
      }),
      pr("claude/fork", [{ conclusion: "FAILURE" }], { isCrossRepository: true }),
      pr("claude/moved", [{ conclusion: "FAILURE" }], { headRefOid: "abc" }),
    ];
    expect(
      failingAgentPRs(candidates, BOT).map(
        (candidate: { headRefName: string }) => candidate.headRefName
      )
    ).toEqual(["claude/failing"]);
  });

  it("fails closed for missing configuration or malformed input", () => {
    expect(failingAgentPRs([pr("claude/failing", [{ conclusion: "FAILURE" }])], "")).toEqual([]);
    expect(failingAgentPRs(null, BOT)).toEqual([]);
  });
});
