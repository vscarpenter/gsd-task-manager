# Cycle D — The Night Shift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A nightly local routine that triages failing checks on `claude/*` PRs — auto-fixing mechanical classes on fix PRs, escalating judgment ones, skipping the rest — never merging, with a self-audit report.

**Architecture:** A launchd job at 20:00 runs `triage-run.sh`, which checks the `triage:paused` kill switch and finds failing `claude/*` PRs (via the tested `failing-agent-prs.cjs` filter) before invoking `claude -p "/triage-prs"` in an isolated worktree. Reuses cycle B's wrapper/worktree/logging patterns.

**Tech Stack:** Bash, `gh` CLI, Claude Code CLI, launchd (`StartCalendarInterval`), Node CommonJS (`.cjs`), Vitest.

## Global Constraints

- Scope: `claude/*` PRs only. Never touch hand-authored branches.
- Hard limits: never merge / force-push / push to a branch it didn't create / edit `.github/workflows/**`, `docker/**`, CloudFront, or security config; never patch around a security-scan failure (escalate); ≤3 fix PRs/run; isolated worktree only.
- Two safety invariants: **verify-before-submit** (open a fix PR only if the failing check now passes locally) and **fixes re-enter the gate** (never merge).
- Escalation label: `ready-for-human` (reuse). Kill switch label: `triage:paused` (new).
- Node helpers `.cjs`; tests `.test.ts` under `tests/`. Commits: Conventional + `Vinny Carpenter <vscarpenter@gmail.com>` + `Claude-Session` trailer, no Co-Authored-By. Repo slug `vscarpenter/gsd-task-manager`.

---

### Task 1: `failing-agent-prs` filter (TDD)

**Files:**
- Create: `scripts/failing-agent-prs.cjs`
- Test: `tests/failing-agent-prs.test.ts`

**Interfaces:**
- `isAgentBranch(headRefName): boolean`; `isFailingCheck(check): boolean`; `failingAgentPRs(prs): object[]`. CLI mode: read `gh pr list --json …` JSON from stdin, print the failing count. Consumed by Task 2.

- [ ] **Step 1: Write the failing test** — `tests/failing-agent-prs.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { isAgentBranch, isFailingCheck, failingAgentPRs } from "../scripts/failing-agent-prs.cjs";

const pr = (headRefName: string, checks: object[]) => ({ headRefName, statusCheckRollup: checks });

describe("isAgentBranch", () => {
  it.each([["claude/fix-a", true], ["claude/issue-3-x", true], ["feat/x", false], ["", false]])(
    "%s -> %s",
    (name, expected) => expect(isAgentBranch(name as string)).toBe(expected)
  );
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
```

- [ ] **Step 2: Run test to verify it fails** — `bun run test -- tests/failing-agent-prs.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write implementation** — `scripts/failing-agent-prs.cjs`

```js
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
```

- [ ] **Step 4: Run test to verify it passes** — `bun run test -- tests/failing-agent-prs.test.ts` → PASS.

- [ ] **Step 5: Commit** `feat(pipeline): failing-agent-prs filter for the night shift`

---

### Task 2: `triage-run.sh` nightly wrapper (+ integration test)

**Files:**
- Create: `scripts/triage-run.sh`
- Test: `tests/triage-run.test.ts`

**Interfaces:** Consumes `failing-agent-prs.cjs` (Task 1). Modes `--check` / `--dry-run` / run; sentinels `PAUSED` / `NO_WORK` / `WORK`.

- [ ] **Step 1: Write the failing test** — `tests/triage-run.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "scripts", "triage-run.sh");
const HELPER = join(__dirname, "..", "scripts", "failing-agent-prs.cjs");

// Stub gh: `gh issue list …` -> paused count; `gh pr list …` -> PR JSON.
function stubGh(pausedCount: number, prsJson: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "ghstub-"));
  const prsFile = join(dir, "prs.json");
  writeFileSync(prsFile, JSON.stringify(prsJson));
  const bin = join(dir, "gh");
  writeFileSync(
    bin,
    `#!/usr/bin/env bash
case "$1" in
  issue) echo ${pausedCount} ;;
  pr) cat ${prsFile} ;;
  *) echo "" ;;
esac
`
  );
  chmodSync(bin, 0o755);
  return dir;
}

function run(mode: string, pausedCount: number, prsJson: unknown): string {
  const stub = stubGh(pausedCount, prsJson);
  return execFileSync("bash", [SCRIPT, mode], {
    env: { ...process.env, PATH: `${stub}:${process.env.PATH}`, GSD_TRIAGE_HELPER: HELPER },
    encoding: "utf8",
  });
}

const failingAgentPr = { headRefName: "claude/fix-a", statusCheckRollup: [{ conclusion: "FAILURE" }] };
const passingAgentPr = { headRefName: "claude/fix-b", statusCheckRollup: [{ conclusion: "SUCCESS" }] };
const failingUserPr = { headRefName: "feat/mine", statusCheckRollup: [{ conclusion: "FAILURE" }] };

describe("triage-run.sh pre-check", () => {
  it("exits PAUSED when triage:paused is set", () => {
    expect(run("--check", 1, [failingAgentPr])).toContain("PAUSED");
  });
  it("exits NO_WORK when no claude/* PR is failing", () => {
    expect(run("--check", 0, [passingAgentPr, failingUserPr])).toContain("NO_WORK");
  });
  it("reports WORK when a claude/* PR is failing", () => {
    expect(run("--check", 0, [failingAgentPr, failingUserPr])).toMatch(/^WORK:/m);
  });
  it("dry-run prints the intended invocation", () => {
    const out = run("--dry-run", 0, [failingAgentPr]);
    expect(out).toMatch(/^WORK:/m);
    expect(out).toContain("/triage-prs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `bun run test -- tests/triage-run.test.ts` → FAIL (script missing).

- [ ] **Step 3: Write `scripts/triage-run.sh`**

```bash
#!/usr/bin/env bash
# GSD Night Shift — launchd entry point (cycle D). Nightly, unattended: triages
# failing checks on the agent fleet's own (claude/*) open PRs. Non-blocking;
# checks the triage:paused kill switch and only invokes Claude when there is
# failing work. See docs/agents/night-shift.md.
set -euo pipefail

REPO="${GSD_TRIAGE_REPO:-vscarpenter/gsd-task-manager}"
WORKTREE="${GSD_TRIAGE_WORKTREE:-$HOME/.gsd-night-shift/worktree}"
SOURCE="${GSD_TRIAGE_SOURCE:-$HOME/Projects/gsd-taskmanager}"
LOG_DIR="${GSD_TRIAGE_LOG_DIR:-$SOURCE/docs/ops/night-shift-logs}"
HELPER="${GSD_TRIAGE_HELPER:-$SOURCE/scripts/failing-agent-prs.cjs}"

MODE="run"
for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE="dry-run" ;;
    --check)   MODE="check" ;;
    "")        ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

gh_fail_log() {
  mkdir -p "$LOG_DIR" 2>/dev/null || true
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG_DIR/gh-errors.log" 2>/dev/null || true
}

# 1. Kill switch.
paused=0
if out=$(gh issue list --repo "$REPO" --label "triage:paused" --state open --json number --jq 'length' 2>/dev/null); then
  paused="$out"
else
  gh_fail_log "issue list triage:paused failed"
fi
if [ "$paused" != "0" ]; then
  echo "PAUSED: triage:paused is set — exiting."
  exit 0
fi

# 2. Work check — failing claude/* PRs (filter lives in the tested helper).
prs_json='[]'
if out=$(gh pr list --repo "$REPO" --state open --json number,headRefName,statusCheckRollup 2>/dev/null); then
  prs_json="$out"
else
  gh_fail_log "pr list failed"
fi
failing="$(printf '%s' "$prs_json" | node "$HELPER" 2>/dev/null || echo 0)"
if [ "$failing" = "0" ]; then
  echo "NO_WORK: no failing claude/* PRs — exiting."
  exit 0
fi
echo "WORK: failing claude/* PRs=$failing"

if [ "$MODE" = "check" ]; then exit 0; fi
if [ "$MODE" = "dry-run" ]; then
  echo "DRYRUN: would run 'claude -p /triage-prs' in $WORKTREE"
  exit 0
fi

# 3. Isolation — dedicated worktree off latest origin/main.
mkdir -p "$(dirname "$WORKTREE")" "$LOG_DIR"
git -C "$SOURCE" fetch origin main --quiet
if git -C "$SOURCE" worktree list --porcelain | grep -q "^worktree $WORKTREE$"; then
  git -C "$WORKTREE" reset --hard origin/main
else
  git -C "$SOURCE" worktree add --force "$WORKTREE" origin/main
fi

# 4. Invoke + 5. Log.
run_id="night-shift-$(git -C "$SOURCE" rev-parse --short origin/main)-$$"
echo "RUN: $run_id"
(
  cd "$WORKTREE" &&
  claude -p "/triage-prs" \
    --allowedTools "Bash(git*),Bash(gh*),Bash(bun*),Bash(node*),Edit,Write,Read"
) 2>&1 | tee "$LOG_DIR/$run_id.log"
```

- [ ] **Step 4: Run test to verify it passes** — `bun run test -- tests/triage-run.test.ts` → PASS (4 cases).

- [ ] **Step 5: `bash -n scripts/triage-run.sh`** → no syntax error.

- [ ] **Step 6: Commit** `feat(pipeline): triage-run.sh nightly wrapper with tested pre-check`

---

### Task 3: `triage:paused` label

**Files:** Modify `scripts/setup-labels.sh`

- [ ] **Step 1: Add** in a new "Cycle D" block:

```bash
# Cycle D — the night shift.
create "triage:paused"   "b60205" "Kill switch — halts the nightly triage routine"
```

- [ ] **Step 2: Verify** — `bash -n scripts/setup-labels.sh && grep -c '^create ' scripts/setup-labels.sh` → `11`.

- [ ] **Step 3: Commit** `feat(pipeline): add triage:paused kill-switch label`

---

### Task 4: `.claude/commands/triage-prs.md`

**Files:** Create `.claude/commands/triage-prs.md`

- [ ] **Step 1: Write the command** (matches `.claude/commands/` convention). Content: the per-run triage loop from spec §3 — iterate failing `claude/*` PRs oldest-first, ≤3 fix PRs; per failing check reproduce → classify (eslint --fix / prettier --write / bun install / merge origin/main / simple typecheck+import) → **verify the check now passes** → open a fix PR targeting the failing branch (never merge, fresh `claude/fix-*` branch), else escalate (`ready-for-human` + written reason; security failures always escalate) or skip+log. Restate the hard limits inline. End by writing the self-audit report to the Night Shift Control issue. Points to `docs/agents/night-shift.md` and `coding-standards.md`.

- [ ] **Step 2: Verify references** — `grep -q "night-shift.md" .claude/commands/triage-prs.md && grep -q "ready-for-human" .claude/commands/triage-prs.md && echo OK`.

- [ ] **Step 3: Commit** `feat(pipeline): /triage-prs night-shift command`

---

### Task 5: `docs/agents/night-shift.md`

**Files:** Create `docs/agents/night-shift.md`

- [ ] **Step 1: Write the operating spec** — sections: role & nightly loop; the auto-fix / escalate / skip policy table; the two safety invariants (verify-before-submit, re-enter-gate); the hard limits (spec §5 verbatim); the self-audit report format; the `triage:paused` kill switch. Extends `docs/agents/`.

- [ ] **Step 2: Cross-reference check** — `for l in triage:paused ready-for-human; do grep -q "$l" scripts/setup-labels.sh docs/agents/triage-labels.md || echo "MISSING: $l"; done; grep -q "verify" docs/agents/night-shift.md && echo OK`.

- [ ] **Step 3: Commit** `docs(pipeline): night-shift operating spec + self-audit report`

---

### Task 6: launchd plist (nightly 20:00)

**Files:** Create `scripts/launchd/dev.vinny.gsd-night-shift.plist`

- [ ] **Step 1: Write the plist** — `StartCalendarInterval` Hour 20, runs `triage-run.sh`, `RunAtLoad` false, logs to `~/.gsd-night-shift/`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!--
  launchd template for the GSD night shift (cycle D). Runs at 20:00 local.
  Install:   cp scripts/launchd/dev.vinny.gsd-night-shift.plist ~/Library/LaunchAgents/
             launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.vinny.gsd-night-shift.plist
  Halt:      add the triage:paused label to the Night Shift Control issue.
  Uninstall: launchctl bootout gui/$(id -u)/dev.vinny.gsd-night-shift; rm ~/Library/LaunchAgents/dev.vinny.gsd-night-shift.plist
-->
<plist version="1.0">
<dict>
  <key>Label</key><string>dev.vinny.gsd-night-shift</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/vinnycarpenter/Projects/gsd-taskmanager/scripts/triage-run.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>/Users/vinnycarpenter/.gsd-night-shift/launchd.out.log</string>
  <key>StandardErrorPath</key><string>/Users/vinnycarpenter/.gsd-night-shift/launchd.err.log</string>
</dict>
</plist>
```

- [ ] **Step 2: Validate** — `plutil -lint scripts/launchd/dev.vinny.gsd-night-shift.plist` → `OK`.

- [ ] **Step 3: Commit** `chore(pipeline): launchd plist for the night shift (nightly 20:00)`

---

## Full-suite verification (after all tasks)

- [ ] `bun run test -- tests/failing-agent-prs.test.ts tests/triage-run.test.ts` — green.
- [ ] `bash -n scripts/triage-run.sh scripts/setup-labels.sh`; `plutil -lint` the plist.
- [ ] Cross-ref: `triage:paused` / `ready-for-human` resolve; command references the operating spec.
- [ ] `bun run lint` — no new errors.

## Rollout (outside git — requires confirmation)

1. `bash scripts/setup-labels.sh` — create `triage:paused` (idempotent).
2. Push, open PR, merge (CI required).
3. Create the **Night Shift Control** issue (pinned; add `triage:paused` to halt).
4. Install launchd (staged activation): `--dry-run` first, then `launchctl bootstrap`.
5. E2E: a `claude/*` PR with a lint failure → confirm a fix PR appears; `triage:paused` drill → confirm `PAUSED`.

## Self-review (plan vs. spec)

- Spec §1 filter → Task 1 (TDD). §2 wrapper → Task 2 (+ integration test). §3 command → Task 4. §4 operating spec → Task 5. §5 hard limits → Tasks 4 & 5. §6 report + kill switch → Tasks 3, 4, 5. §7 launchd → Task 6. Verification → Task 1/2 tests + full-suite. **All spec sections covered.**
- No placeholders in code steps. `failingAgentPRs`/`isAgentBranch`/`isFailingCheck` names identical across Task 1 (def), Task 2 (consumer via CLI). Sentinels `PAUSED`/`NO_WORK`/`WORK` identical between wrapper and test. Labels `triage:paused` / `ready-for-human` consistent across Tasks 2–5.
