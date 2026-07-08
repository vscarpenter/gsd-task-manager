# Cycle B — Builder + Gate 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local, scheduled Claude routine that claims a `ready-for-agent` contract, writes a risk-scaled plan, stops for a label-swap plan approval (Gate 1), then builds to `coding-standards.md` and opens a PR — never merging.

**Architecture:** A launchd job runs `builder-run.sh` every 30 min. The wrapper pre-checks cheaply (kill switch + work check) and only invokes `claude -p "/build-next"` (in an isolated worktree) when there is work. The builder's behavior lives in versioned instructions (`build-next.md` + `builder.md`). Labels are the durable state machine across non-blocking runs.

**Tech Stack:** Bash, `gh` CLI, Claude Code CLI (`claude -p`), launchd (macOS), Vitest (for the wrapper's decision-logic test), the cycle A `risk:*` labels + PR template.

## Global Constraints

- Additive only — `scripts/`, `.claude/commands/`, `docs/`. Do NOT modify runtime/app code, CI, or deploy config.
- Risk tiers (from cycle A, verbatim): `docs`, `chore`, `feature`, `risky`. `docs`/`chore` auto-approve Gate 1; `feature`/`risky` require it.
- New labels EXACTLY: `plan:pending`, `plan:approved`, `agent:building`, `builder:paused`. Reuse `ready-for-agent`, `ready-for-human` (do not rename).
- Builder hard limits: never merge / push to main / force-push / edit `.github/workflows/**`, `docker/**`, CloudFront, or security config; ≤1 issue planned + ≤1 built per run; isolated worktree only.
- Node helpers `.cjs`; tests `.test.ts` under `tests/` (excluded from `tsc`, run by Vitest). Commits: Conventional + `Vinny Carpenter <vscarpenter@gmail.com>` + `Claude-Session` trailer, no Co-Authored-By.
- Repo slug: `vscarpenter/gsd-task-manager`.

---

### Task 1: New pipeline labels

**Files:** Modify `scripts/setup-labels.sh`

- [ ] **Step 1: Append the four builder labels** after the existing `risk:*` block, before the final echo:

```bash
create "plan:pending"    "fbca04" "Plan posted, awaiting Gate 1 approval"
create "plan:approved"   "0e8a16" "Human approved the plan; build may proceed"
create "agent:building"  "5319e7" "Builder is actively building (claim-lock)"
create "builder:paused"  "b60205" "Kill switch — halts all builder runs"
```

- [ ] **Step 2: Verify syntax + idempotency guard**

Run: `bash -n scripts/setup-labels.sh && grep -c '^create ' scripts/setup-labels.sh`
Expected: no syntax error; `8` create lines (4 risk + 4 builder).

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-labels.sh
git commit   # feat(pipeline): add builder/Gate-1 labels to setup-labels.sh
```

---

### Task 2: `builder-run.sh` wrapper + decision-logic test (TDD)

**Files:**
- Create: `scripts/builder-run.sh`
- Create: `tests/builder-run.test.ts`

**Interfaces:**
- Produces exit code 0 in all pre-check outcomes; prints one of the sentinel lines `PAUSED` / `NO_WORK` / `WORK` (so the test and logs are unambiguous). Modes: `--check` (pre-check only), `--dry-run` (pre-check + print intended invocation), default (full run).

- [ ] **Step 1: Write the failing test** — `tests/builder-run.test.ts`

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(__dirname, "..", "scripts", "builder-run.sh");

// Build a fake `gh` that returns a canned issue count per label query.
function stubGh(counts: Record<string, number>): string {
  const dir = mkdtempSync(join(tmpdir(), "ghstub-"));
  const bin = join(dir, "gh");
  // gh issue list --repo R --label L --state open --json number --jq length
  const script = `#!/usr/bin/env bash
label=""
while [ "$#" -gt 0 ]; do case "$1" in --label) shift; label="$1";; esac; shift; done
case "$label" in
${Object.entries(counts).map(([l, n]) => `  "${l}") echo ${n};;`).join("\n")}
  *) echo 0;;
esac
`;
  writeFileSync(bin, script);
  chmodSync(bin, 0o755);
  return dir;
}

function run(mode: string, counts: Record<string, number>): string {
  const stub = stubGh(counts);
  return execFileSync("bash", [SCRIPT, mode], {
    env: { ...process.env, PATH: `${stub}:${process.env.PATH}` },
    encoding: "utf8",
  });
}

describe("builder-run.sh pre-check", () => {
  it("exits PAUSED when builder:paused is set", () => {
    expect(run("--check", { "builder:paused": 1, "ready-for-agent": 5 })).toContain("PAUSED");
  });
  it("exits NO_WORK when nothing is actionable", () => {
    const out = run("--check", { "builder:paused": 0, "ready-for-agent": 0, "plan:approved": 0 });
    expect(out).toContain("NO_WORK");
  });
  it("reports WORK when ready-for-agent issues exist", () => {
    expect(run("--check", { "builder:paused": 0, "ready-for-agent": 2, "plan:approved": 0 })).toContain("WORK");
  });
  it("reports WORK when plan:approved issues exist", () => {
    expect(run("--check", { "builder:paused": 0, "ready-for-agent": 0, "plan:approved": 1 })).toContain("WORK");
  });
  it("dry-run prints the intended invocation without running claude", () => {
    const out = run("--dry-run", { "builder:paused": 0, "ready-for-agent": 1, "plan:approved": 0 });
    expect(out).toContain("WORK");
    expect(out).toContain("/build-next");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/builder-run.test.ts`
Expected: FAIL — `scripts/builder-run.sh` does not exist.

- [ ] **Step 3: Write `scripts/builder-run.sh`**

```bash
#!/usr/bin/env bash
# GSD Builder — launchd entry point (cycle B: Builder + Gate 1).
# Non-blocking: pre-checks cheaply and invokes the builder only when there is
# work, so most scheduled wake-ups cost zero Claude tokens. Labels are the
# durable state across runs. See docs/agents/builder.md.
set -euo pipefail

REPO="${GSD_BUILDER_REPO:-vscarpenter/gsd-task-manager}"
WORKTREE="${GSD_BUILDER_WORKTREE:-$HOME/.gsd-builder/worktree}"
SOURCE="${GSD_BUILDER_SOURCE:-$HOME/Projects/gsd-taskmanager}"
LOG_DIR="${GSD_BUILDER_LOG_DIR:-$SOURCE/docs/ops/builder-logs}"

MODE="run"
for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE="dry-run" ;;
    --check)   MODE="check" ;;
    "")        ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

count() { gh issue list --repo "$REPO" --label "$1" --state open --json number --jq 'length' 2>/dev/null || echo 0; }

# 1. Kill switch.
if [ "$(count "builder:paused")" != "0" ]; then
  echo "PAUSED: builder:paused is set — exiting."
  exit 0
fi

# 2. Cheap work check.
to_plan="$(count "ready-for-agent")"
to_build="$(count "plan:approved")"
if [ "$to_plan" = "0" ] && [ "$to_build" = "0" ]; then
  echo "NO_WORK: no ready-for-agent or plan:approved issues — exiting."
  exit 0
fi
echo "WORK: ready-for-agent=$to_plan plan:approved=$to_build"

if [ "$MODE" = "check" ]; then exit 0; fi
if [ "$MODE" = "dry-run" ]; then
  echo "DRYRUN: would run 'claude -p /build-next' in $WORKTREE"
  exit 0
fi

# 3. Isolation — refresh a dedicated worktree off latest origin/main.
mkdir -p "$(dirname "$WORKTREE")" "$LOG_DIR"
git -C "$SOURCE" fetch origin main --quiet
if [ -d "$WORKTREE/.git" ] || git -C "$SOURCE" worktree list | grep -q "$WORKTREE"; then
  git -C "$SOURCE" -C "$WORKTREE" reset --hard origin/main
else
  git -C "$SOURCE" worktree add --force "$WORKTREE" origin/main
fi

# 4. Invoke the builder (scoped tools; bounded time). 5. Log.
run_id="builder-$(git -C "$SOURCE" rev-parse --short origin/main)-$$"
echo "RUN: $run_id"
( cd "$WORKTREE" && claude -p "/build-next" \
    --allowedTools "Bash(git*),Bash(gh*),Bash(bun*),Edit,Write,Read" \
  ) 2>&1 | tee "$LOG_DIR/$run_id.log"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `chmod +x scripts/builder-run.sh && bun run test -- tests/builder-run.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Static lint + real dry-run against a stub**

Run: `bash -n scripts/builder-run.sh` and a manual dry-run with a stubbed `gh` on PATH to observe `WORK` + `DRYRUN` lines.
Expected: syntax OK; branches behave.

- [ ] **Step 6: Commit**

```bash
git add scripts/builder-run.sh tests/builder-run.test.ts
git commit   # feat(pipeline): builder-run.sh wrapper with tested pre-check + kill switch
```

---

### Task 3: `docs/agents/builder.md` — operating spec

**Files:** Create `docs/agents/builder.md`

- [ ] **Step 1: Write the operating spec** with these sections (prose):
  - **Role & loop** — the state machine diagram from the spec.
  - **Risk → plan depth** — `docs`/`chore` lightweight + auto-approve; `feature`/`risky` full plan + Gate 1. Full-plan format references `docs/superpowers/plans/` structure.
  - **Gate 1 protocol** — post plan comment; `ready-for-agent` → `plan:pending`; stop. `/revise <notes>` → re-plan. Approval = human swaps `plan:pending` → `plan:approved`.
  - **Build** — claim (`agent:building`); TDD to `coding-standards.md`; branch `claude/issue-<n>-<slug>`; PR via cycle A template, `Closes #<n>`, carry `risk:*`, rollback from contract; remove `agent:building`; comment PR link.
  - **Separation of duties** — the §5 hard limits, verbatim.
  - **Escalation** — ambiguity/judgment/limit → `ready-for-human` + written reason; never guess.
  - **Issue-tracker ops** — reference `docs/agents/issue-tracker.md` for `gh` conventions.

- [ ] **Step 2: Cross-reference check** — every label and file the doc names exists.

Run: `for l in ready-for-agent plan:pending plan:approved agent:building ready-for-human; do grep -q "$l" scripts/setup-labels.sh docs/agents/triage-labels.md || echo "MISSING: $l"; done; test -f coding-standards.md && echo "standards OK"`
Expected: no MISSING lines; `standards OK`.

- [ ] **Step 3: Commit** `docs(pipeline): builder operating spec (risk-scaled plan, Gate 1, SoD)`

---

### Task 4: `.claude/commands/build-next.md` — the builder command

**Files:** Create `.claude/commands/build-next.md`

- [ ] **Step 1: Write the command** (matches the `.claude/commands/` convention). Content: a tight, imperative instruction set that has Claude process **at most one** issue per run per §3 of the spec — plan pass (risk-scaled, auto-approve docs/chore, else `plan:pending`+stop), build pass (claim → TDD build → branch → PR → comment), revise handling, escalation — and points to `docs/agents/builder.md` for the full operating spec and `coding-standards.md` for the definition of done. Explicitly restates the separation-of-duties limits so a headless run cannot drift past them.

- [ ] **Step 2: Verify it references the operating spec + standards**

Run: `grep -q "builder.md" .claude/commands/build-next.md && grep -q "coding-standards.md" .claude/commands/build-next.md && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit** `feat(pipeline): /build-next builder command`

---

### Task 5: launchd plist template

**Files:** Create `scripts/launchd/dev.vinny.gsd-builder.plist`

- [ ] **Step 1: Write the plist** — `StartInterval` 1800s, runs `builder-run.sh`, redirects stdout/stderr to a log, `RunAtLoad` false:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>dev.vinny.gsd-builder</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/vinnycarpenter/Projects/gsd-taskmanager/scripts/builder-run.sh</string>
  </array>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>/Users/vinnycarpenter/.gsd-builder/launchd.out.log</string>
  <key>StandardErrorPath</key><string>/Users/vinnycarpenter/.gsd-builder/launchd.err.log</string>
</dict>
</plist>
```

- [ ] **Step 2: Validate the plist**

Run: `plutil -lint scripts/launchd/dev.vinny.gsd-builder.plist`
Expected: `OK`.

- [ ] **Step 3: Commit** `chore(pipeline): launchd plist template for the builder (30-min cadence)`

---

## Full-suite verification (after all tasks)

- [ ] `bun run test -- tests/builder-run.test.ts` — wrapper decision logic green.
- [ ] `bash -n scripts/builder-run.sh scripts/setup-labels.sh` — shells parse.
- [ ] `plutil -lint scripts/launchd/dev.vinny.gsd-builder.plist` — plist valid.
- [ ] Cross-ref: labels in `build-next.md`/`builder.md` all exist in `setup-labels.sh`.
- [ ] `bun run lint` — no new errors from added files.

## Rollout (outside git — requires confirmation)

1. `bash scripts/setup-labels.sh` — create the 4 new labels (idempotent; re-run).
2. Push branch, open PR, merge (CI is now a required gate).
3. Install launchd: copy plist to `~/Library/LaunchAgents/`, `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.vinny.gsd-builder.plist`.
4. End-to-end: file a `risk:chore` contract → `ready-for-agent` → observe auto-approve + PR; file a `risk:feature` one → observe `plan:pending`, approve, observe build + PR.
5. Kill-switch drill: open a "Builder Control" issue, add `builder:paused`, confirm the next run exits `PAUSED`.

## Self-review (plan vs. spec)

- Spec §1 labels → Task 1. §2 wrapper → Task 2 (+ TDD test). §3 command → Task 4. §4 operating spec → Task 3. §5 SoD → embedded in Tasks 3 & 4. §6 launchd → Task 5. Verification approach → Task 2 test + full-suite. **All spec sections covered.**
- No placeholders in code steps; prose docs (Tasks 3–4) have concrete required-section lists.
- Label/name consistency: `plan:pending`/`plan:approved`/`agent:building`/`builder:paused` identical across Tasks 1, 2, 3, 4; sentinel lines `PAUSED`/`NO_WORK`/`WORK` identical between wrapper (Task 2 Step 3) and test (Task 2 Step 1).
