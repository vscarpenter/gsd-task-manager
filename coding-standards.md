# Code Standards & Agentic Guidance v17.1

**Purpose.** Directives governing how LLMs approach complex, multi-step development tasks. Optimized for the Claude Code harness. Every directive applies to every coding session.

**How to use this file.** This is the full reference. Load only what's needed at runtime. Enforce mechanical rules with hooks, not prose.

**Portability (Claude Code and Codex).** Parts 1 through 4 and Part 6 belong in both `CLAUDE.md` and a Codex `AGENTS.md`. Harness mechanics are Claude Code specific and are tagged. When generating an `AGENTS.md` for Codex, omit Part 5 and hook examples. Canonical prompt text lives in `.claude/commands/`; port those files to Codex's custom prompt mechanism rather than inlining them.

---

## Part 1: The Agentic Lifecycle

### Phase 1: Pre-computation & Discovery

**1. Codebase Orientation (REQUIRED before first write)**
* Read `README.md`, `CLAUDE.md`, and `CONTRIBUTING.md`. Explore directory structure.
* Identify existing patterns: naming, module organization, error handling, test structure, and verification commands.
* Check for existing utilities before creating new helpers.
* **Investigate before answering:** Never speculate about code you have not opened. If the user references a specific file, read it before answering.
* **Resumed sessions:** Read `CLAUDE.md` → `tasks/lessons.md` → `tasks/todo.md` → `tasks/implementation-notes.md` → `git log`. Do not ask for re-explanation of captured state.
* Match existing style exactly. The codebase is the primary style guide.

**2. Task Tiers**
* **Trivial:** One file, <20 lines, no interface change (typo, config). *Skip spec/approval. Fix, verify, commit.*
* **Standard:** Few files, bounded scope, no new public contract. *Lightweight plan in `tasks/todo.md`. Test-first for real logic.*
* **Non-trivial:** Coordinated changes, >50 lines, public interface changes, shared code, or infrastructure. *Full process: `tasks/spec.md`, approval, red/green/refactor, ADR if architecture changes.*
* **Boundary rule:** When a task sits on a tier boundary, state which tier you picked and why before proceeding.

**3. Handling Ambiguity**
* Ask before assuming. If assuming, list every assumption explicitly.
* Prefer reversible choices when proceeding under an explicit assumption.
* **Unknowns Interview (Non-trivial):** Before requesting spec approval, ask one question at a time. Prioritize blast-radius (data models, architecture, public interfaces). Fold answers into `tasks/spec.md`.

**4. Tool Efficiency**
* Use `rg`, `git status`, `git diff`, and `git log` directly for discovery and verification.
* Use parallel tool calls when tasks are independent. Reserve sequential execution for true dependencies.
* Set explicit timeouts for long-running operations.
* Clean up temporary files, helper scripts, scratchpads, and iteration artifacts before declaring the task complete.
* Never use placeholders or guess missing parameters.

### Phase 2: Implementation Execution

**1. Spec-Driven Development (REQUIRED for non-trivial tasks)**
* Write `tasks/spec.md` before coding. Include: Goal, Inputs/Outputs, Constraints, Edge Cases, Out of Scope, Acceptance Criteria, Test Stubs.
* Do not start coding until the user approves the spec.
* Treat contract drift as a failure. If inputs, outputs, constraints, scope, or acceptance criteria change, STOP, update the spec, and get re-approval.

**2. Scope Discipline & Incremental Progress**
* **Scope:** Do NOT add features, refactor, or improve beyond what was asked. No YAGNI.
* Do not add docstrings, comments, type annotations, abstractions, or cleanup outside the touched scope.
* **Defensive coding:** Validate at system boundaries only. Trust internal guarantees.
* **Execution:** One red/green/refactor cycle at a time. Do not assume correctness without execution.
* For long-running work, commit each functional change or logical unit before continuing.

**3. Verification Plan**
* Define the verification method before coding.
* Match verification to the domain: backend tests, API integration checks, frontend browser/screenshot/accessibility checks, data row-count diffs, infrastructure plans, smoke tests, or project-specific runners.
* Confirm the loop is fast and runnable autonomously before investing heavily in implementation.

**4. Deviations Ledger & Stop Conditions**
* **Halt & Re-plan if:** A plan breaks, context budget hits 80%, a test cannot be written first, verification surfaces unexplainable results, or required clarification is missing.
* **Log deviations:** Record tactical deviations in `tasks/implementation-notes.md`. If the contract drifts (inputs/outputs change), STOP and update the spec for re-approval.
* Diagnose root cause before patching when verification fails. Avoid trial-and-error fixes.

**5. Hard-to-Reverse Action Safety**
* **Confirm before proceeding on:** `rm -rf`, dropping tables, deleting branches, force-deleting files, `git push --force`, `git reset --hard`, amending published commits, modifying shared infra, pushing code, commenting on PRs/issues, or sending external messages.
* Local reversible actions require no confirmation.
* Never bypass safety checks with shortcuts like `--no-verify`. Do not discard unfamiliar files.

### Phase 3: Handoff & Delivery

**1. Git Workflow**
* Commit format: `<type>(<scope>): <description>`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`.
* Imperative mood, lowercase, no period, max 72 chars.
* Branch format: `<type>/<short-description>` when creating a branch.
* PRs should cover one logical concern. Split large PRs unless the split makes review less clear.
* PR descriptions should include what changed, why it changed, how to test locally, screenshots for UI changes, and known deferred follow-ups.

**2. Session Handoff Protocol (REQUIRED before ending)**
* Commit all working code. Never leave significant work uncommitted.
* Update `tasks/todo.md` with "Resuming From Here": completed work, next steps, blockers, and assumptions.
* Run the test suite. Do not end with failing tests.
* **Self-Improvement Loop:** Distill `tasks/implementation-notes.md` into `tasks/lessons.md` (project learnings) or `CLAUDE.md` (behavioral rules), then delete the ledger.

**3. Comprehension Gate (Non-trivial tier)**
* Before PR, generate a change report (context, intent, what changed, why it changed, and existing code paths affected) and a 5-10 question quiz testing edge cases and blast radius.
* The user must pass before merging. A miss means re-reading the report, not retaking until lucky.
* Never merge code you cannot explain.

---

## Part 2: Non-Negotiable Invariants

*Note: Linting, formatting (Biome), and dependency audits are enforced via background hooks where available. Fix any hook failures autonomously and immediately.*

### Code Quality & Structure
* **Simplicity:** Simplicity over cleverness. Build small, iterate fast.
* **Human readability:** A junior engineer should understand the change without flipping across many files.
* **Dependencies:** Standard lib > external. Only add a dep if it cuts >2x the code.
* **Types:** Type annotations required on ALL function signatures. Strict compiler settings enabled. Never use `any` or `object` without a justification comment.
* **Constraints:** Functions ≤ 40 lines. Max 3 levels of nesting. No magic numbers. Limit files to ~400 lines.
* **Comments:** Explain WHY, not WHAT.
* **Abstraction:** Apply DRY at the third occurrence. Duplicate twice if clearer than abstracting. Do not create helpers for one-time operations.
* **Design:** Prefer composition over inheritance. Inject I/O, time, randomness, and external services instead of hard-coding them.
* **Tests:** Solve generally, not just for the current test cases.

### Dependency Management
* Pin production dependency versions in lockfiles. Avoid floating ranges.
* Review maintenance health, license, security posture, bundle/runtime impact, and transitive dependency risk before adding a dependency.
* Remove unused dependencies promptly.
* New dependencies must be justified, reviewed, audited, and locked before completion.

### Security & Error Handling
* **Security:** Validate/sanitize all user inputs. Parameterized queries only. Least-privilege. No committed secrets.
* **Errors:** Fail fast with clear messages. Typed/custom errors for domain-specific failures.
* **Exceptions:** Re-raise or handle. NEVER swallow exceptions.
* **Logging:** Log with useful context and no secrets.
* **Retries:** Retry transient failures deliberately with bounded exponential backoff when appropriate.

### Testing (Red/Green/Refactor)
* **Metrics:** Target 80% coverage floor. **100% coverage of spec acceptance criteria.**
* **Structure:** Arrange-Act-Assert. One assertion concept per test. Include positive and negative cases. Unit tests <100ms.
* **Rule:** If you cannot write a failing test first, you do not understand the requirement.
* Confirm the red test fails for the right reason before writing implementation.
* Refactor only after green, and only to simplify, remove duplication, or improve naming without changing behavior.

---

## Part 3: Architecture & Decisions

**Architecture Decision Records (ADRs)**
Required when a decision is hard to reverse, affects multiple systems or teams, or future engineers will wonder why it was made. Location: `docs/adr/NNNN-short-title.md`.

| Field | Content |
|---|---|
| Date / Status / Deciders | YYYY-MM-DD \| Proposed/Accepted/Deprecated/Superseded \| Names |
| Context / Decision | Problem prompting the decision \| What was decided |
| Consequences / Alternatives | What is easier/harder/out of scope \| Rejected options and why |

**Rule:** If an architectural choice needs a Slack thread or PR comment to explain it, it probably belongs in an ADR.

---

## Part 4: Prompt Engineering Standards

**Prompt Structure:** Role/Context → Task → Constraints → Anti-goals → Output Format.

**Prompt Sources:** Canonical prompt text lives in `.claude/commands/` (`qspec.md`, `tdd.md`, `qcheck.md`, and successors). The executable prompt file is the source of truth. Edit wording there, not in scattered docs or ad hoc chat prompts.

**Prompt Anti-Patterns (DO NOT USE):**
* Vague goals ("make this better") or conversational framing.
* Missing constraints or anti-goals (invites scope creep).
* Stacked goals (asking for spec, code, and docs simultaneously).
* Implicit context, scope, or ambition. Say exactly what should be included.
* Severity self-censorship ("only flag high-severity").
* No exit conditions ("keep checking until..."). Use outcome-defined conditions instead.
* Skipping TDD in the prompt for Standard or Non-trivial implementation work.

---

## Part 5: Claude Code Primitives

*Claude Code specific. Omit from Codex `AGENTS.md`.*

* **Routing:** Commands initiate, subagents verify, hooks gate.
* **Slash Commands (`.claude/commands/`):** Short, repeatable actions. Canonical text of prompts lives here (e.g., `/qspec`, `/tdd`, `/qcheck`).
* **Skills (`.claude/skills/`):** Complex multi-step workflows. Write descriptions as triggers ("when should I fire?"). Provide goals, constraints, and a "Gotchas" section.
* **Subagents (`.claude/agents/`):** Spawn for fanning out or parallel reads. Skip for <3 tool calls. Read-only agents use `haiku`; write agents use `sonnet`/`opus` with `isolation: worktree`.
* **Agent teams vs subagents:** Use subagents for scoped delegation inside one workstream. Use teams when work should split across longer-lived sessions that coordinate.
* **Hooks:** Enforce standards mechanically (e.g., `PostToolUse`, `Stop`). Hook types: shell commands, prompt hooks, MCP tool hooks.
* Hooks receive event data as JSON on stdin. Read fields with `jq`, for example `.tool_input.file_path`; do not rely on `$CLAUDE_FILE_PATH` style variables unless explicitly configured.

---

## Part 6: Exit & Validation Matrix

**ALL items must be TRUE before declaring a task "Done" or ending a session.**

**Code & Execution**
- [ ] No speculation occurred; relevant codebase files were read first.
- [ ] Existing utilities and patterns were checked before new helpers were created.
- [ ] Correct task tier was selected; boundary cases were explained.
- [ ] Spec-driven development used for non-trivial work.
- [ ] Code is minimalist; no out-of-scope refactoring, documentation, type churn, or YAGNI features.
- [ ] Implementation was written strictly AFTER tests (Red/Green/Refactor).
- [ ] Red tests failed for the right reason before implementation.
- [ ] All acceptance criteria have corresponding passing tests.
- [ ] Verification method was defined before coding and matched to the domain.
- [ ] Relevant tests, type checks, linting, formatting, and security checks pass.
- [ ] Every changed file was re-read for typos, debug code, TODOs, dead imports, unused code, naming drift, and untested error paths.
- [ ] No hard-to-reverse actions were executed without explicit user confirmation.
- [ ] Elegance Check passed (junior engineer readable, minimal diff, justified branches).
- [ ] Temporary files, helper scripts, and scratchpads were removed.

**Process & Handoff**
- [ ] Task plan (`tasks/todo.md`) updated with progress and "Resuming From Here".
- [ ] `tasks/lessons.md` updated with any required corrections from this session.
- [ ] New dependencies justified, reviewed, audited, and locked in the lockfile.
- [ ] ADR written for architectural changes.
- [ ] PR covers one logical concern and includes what changed, why, and how to test.
- [ ] Comprehension quiz passed by user (Non-trivial tier only).
- [ ] All code committed and tests pass.

---

## Part 7: Red Flags Index

Use this as a fast drift check when behavior feels off.

| Red flag | Corrective action |
|---|---|
| Speculating about code without opening files | Stop and inspect the relevant files. |
| Writing code before reading existing patterns | Return to Codebase Orientation. |
| Applying full ceremony to a trivial fix | Re-tier the task and simplify. |
| Implementing without a spec on non-trivial work | Stop, write the spec, and get approval. |
| Coding before tests | Re-enter red/green/refactor. |
| Pushing through a broken plan | Re-plan before continuing. |
| Trial-and-error fixes | Diagnose root cause before patching. |
| Silent deviation from plan | Log the deviation or update the spec. |
| Scope creep outside the request | Revert or isolate out-of-scope changes. |
| Ending with failing tests or uncommitted work | Fix, commit, or clearly hand off blockers. |
| Hard-to-reverse action without confirmation | Stop and ask for explicit approval. |
| Non-trivial work done without report and quiz | Run the comprehension gate. |

---

> "Code should be safe to modify, easy to reason about, and boring to maintain. When in doubt, simplify."
>
> Vinny Carpenter, Document Version 17.1
