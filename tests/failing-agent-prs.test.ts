import { describe, it, expect } from "vitest";
import {
  isAgentBranch,
  isTrustedProvenance,
  isFailingCheck,
  failingAgentPRs,
} from "../scripts/failing-agent-prs.cjs";

// Default provenance is a same-repo branch (`isCrossRepository: false`) so the
// existing checks-focused cases stay about check state; pass an override to model
// a fork or a bare (no-provenance) PR.
const pr = (headRefName: string, checks: object[], provenance: object = { isCrossRepository: false }) => ({
  headRefName,
  statusCheckRollup: checks,
  ...provenance,
});

describe("isAgentBranch", () => {
  it.each([
    ["claude/fix-a", true],
    ["claude/issue-3-x", true],
    ["feat/x", false],
    ["", false],
  ])("%s -> %s", (name, expected) => expect(isAgentBranch(name as string)).toBe(expected));
  it("is false for non-strings", () => expect(isAgentBranch(undefined as unknown as string)).toBe(false));
});

describe("isTrustedProvenance", () => {
  it("trusts a same-repo branch (isCrossRepository false)", () =>
    expect(isTrustedProvenance({ isCrossRepository: false })).toBe(true));
  it("trusts a head repo owned by the base-repo owner", () =>
    expect(isTrustedProvenance({ headRepositoryOwner: { login: "vscarpenter" } }, "vscarpenter")).toBe(true));
  it.each([["OWNER"], ["MEMBER"], ["COLLABORATOR"]])(
    "trusts a %s author",
    (assoc) => expect(isTrustedProvenance({ authorAssociation: assoc })).toBe(true)
  );
  it("distrusts a fork by an external contributor", () =>
    expect(
      isTrustedProvenance(
        { isCrossRepository: true, headRepositoryOwner: { login: "attacker" }, authorAssociation: "CONTRIBUTOR" },
        "vscarpenter"
      )
    ).toBe(false));
  it("distrusts a fork whose head owner differs from the base-repo owner", () =>
    expect(isTrustedProvenance({ headRepositoryOwner: { login: "attacker" } }, "vscarpenter")).toBe(false));
  it("still trusts a fork opened by a trusted maintainer author", () =>
    expect(
      isTrustedProvenance({ isCrossRepository: true, headRepositoryOwner: { login: "attacker" }, authorAssociation: "MEMBER" }, "vscarpenter")
    ).toBe(true));
  it("fails safe: no provenance data is untrusted", () =>
    expect(isTrustedProvenance({}, "vscarpenter")).toBe(false));
  it("fails safe: missing head owner with no base owner is untrusted", () =>
    expect(isTrustedProvenance({ headRepositoryOwner: { login: "vscarpenter" } })).toBe(false));
  it("is false for null", () => expect(isTrustedProvenance(null)).toBe(false));
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
  it("includes a same-repo agent branch with a failing check", () => {
    expect(failingAgentPRs([pr("claude/fix-a", [{ conclusion: "FAILURE" }])])).toHaveLength(1);
  });
  it("includes a same-repo agent branch matched by base-repo owner", () => {
    const own = pr("claude/fix-a", [{ conclusion: "FAILURE" }], { headRepositoryOwner: { login: "vscarpenter" } });
    expect(failingAgentPRs([own], "vscarpenter")).toHaveLength(1);
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
  it("excludes a FORK agent branch even if failing (spoofed claude/ prefix)", () => {
    const fork = pr("claude/fix-ci", [{ conclusion: "FAILURE" }], {
      isCrossRepository: true,
      headRepositoryOwner: { login: "attacker" },
    });
    expect(failingAgentPRs([fork], "vscarpenter")).toHaveLength(0);
  });
  it("fails safe: excludes a failing agent branch with no provenance data", () => {
    const bare = { headRefName: "claude/fix-a", statusCheckRollup: [{ conclusion: "FAILURE" }] };
    expect(failingAgentPRs([bare], "vscarpenter")).toHaveLength(0);
  });
  it("includes when any one check fails (mixed)", () => {
    expect(failingAgentPRs([pr("claude/fix-a", [{ conclusion: "SUCCESS" }, { state: "FAILURE" }])])).toHaveLength(1);
  });
  it("returns [] for empty/malformed input", () => {
    expect(failingAgentPRs([])).toEqual([]);
    expect(failingAgentPRs(null as unknown as object[])).toEqual([]);
  });
});
