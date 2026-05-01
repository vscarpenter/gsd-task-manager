# Code Standards & Agentic Guidance v14.0


**Purpose.** Directives governing how LLMs approach complex, multi-step development tasks. Optimized for Claude Opus 4.7 and the Claude Code harness. Every directive applies to every coding session.

**How to use this file.** This is the full reference. For runtime use, load only what's needed: a short global `~/.claude/CLAUDE.md` for universal rules, a per-project `CLAUDE.md` for stack and patterns, and this document as a skill at `.claude/skills/coding-standards/SKILL.md` for on-demand reference. Enforce mechanical rules with hooks, not prose.

---

## Part 1: Agentic Behavior

### Codebase Orientation (REQUIRED before first write)

1. Read README, CLAUDE.md, and CONTRIBUTING docs first.
2. Explore the directory structure. Understand the project layout.
3. Identify existing patterns: naming, module organization, error handling, test structure.
4. Check for existing utilities and helpers before creating new ones.
5. Match existing code style exactly, even if it differs from these standards.

**Resumed sessions:** Read CLAUDE.md → `tasks/lessons.md` → `tasks/todo.md` → check git log (last 3-5 commits). Do not ask the user to re-explain context captured in these files.

**Rule:** The existing codebase is the primary style guide. These standards apply to greenfield code or explicit refactoring.

### Spec-Driven Development (REQUIRED for non-trivial tasks)

1. Write the spec first. Create `tasks/spec.md` before any implementation begins.
2. Define the contract: inputs, outputs, constraints, edge cases, and what success looks like.
3. State anti-goals explicitly. What this does NOT do. Prevents scope creep.
4. Get approval. Do not start coding until the spec is reviewed and confirmed.
5. Treat drift as a failure. Update the spec first and get re-confirmation before continuing.

**Spec template fields:**

| Field | Content |
|---|---|
| Goal | One sentence: what this does and why. |
| Inputs / Outputs | What goes in, what comes out, what format. |
| Constraints | Performance, security, compatibility, size requirements. |
| Edge Cases | Empty inputs, nulls, concurrent calls, failure modes. |
| Out of Scope | Explicit list of what this version does not handle. |
| Acceptance Criteria | Checkable statements that prove the implementation is correct. |
| Test Stubs | Draft test function names (empty bodies) mapping to each criterion. Shipped with the spec. |

**Rule:** Code without a spec is a guess. A spec written after the code is a rationalization. Write it first.

### Handling Ambiguity

- **Ask before assuming.** If a requirement has multiple valid interpretations, ask which is intended.
- **State your assumptions.** If proceeding without clarification, list every assumption explicitly.
- **Prefer reversible choices.** When guessing, choose the option easiest to change later.
- **Flag scope questions early.** Confirm scope before modifying shared code, external APIs, or infrastructure.
- **Stop and re-plan when a plan breaks.** Do not push through ambiguity by guessing forward.

**Never:** Silently interpret ambiguous requirements and build an entire solution on an assumption that could be wrong.

### Tool Efficiency

Claude executes tool calls in parallel by default. Reserve sequential execution for true dependencies (output of A feeds input of B). For everything else, fire concurrently.

- Use `grep` or `ripgrep` to search across files instead of reading them individually.
- Use `git log`, `git diff`, and `git status` directly rather than asking Claude to summarize manually.
- For bulk refactors, use `sed` or `awk` on multiple files in one pass.
- Set explicit timeouts upfront for long-running bash operations.

### Context Management & Sustained Work

1. Outline the implementation plan with milestones and acceptance criteria for each.
2. Work systematically through each milestone. Commit functional changes frequently.
3. Commit at least every significant component or logical unit of work.
4. Monitor context usage. Prioritize committing working code before context exhaustion.
5. Never leave significant work uncommitted.

**Critical:** If you find yourself 80% through context with major uncommitted work, stop adding features and commit immediately.

**Prefer fresh context over compaction.** State lives in `tasks/`. Resume by reading those files (CLAUDE.md, `tasks/todo.md`, `tasks/lessons.md`, recent git log), not by summarizing chat history. Opus 4.7 is effective at discovering state from the local filesystem; lean on that.

Every multi-step task must have a stated "done" condition the model can recognize autonomously. Define outcomes, not process.

- ❌ Process-defined: "Keep checking the logs until you find the error."
- ✓ Outcome-defined: "Check the last 100 lines of logs. If you find an error, explain root cause and propose one fix. If none found, say so and stop."

### Session Handoff Protocol (REQUIRED before ending)

1. Commit all working code. Do not leave meaningful work uncommitted.
2. Update `tasks/todo.md` with "Resuming From Here": completed, next steps, blockers, assumptions made.
3. Note assumptions made during the session that future work depends on.
4. Run the test suite. Do not end with failing tests.

**Rule:** A clean handoff is as important as clean code. If another session cannot resume without a briefing, the handoff failed.

### Self-Improvement Loop

After any correction from the user, capture the pattern in `tasks/lessons.md` immediately. End every correction session with: *"Update CLAUDE.md so this mistake does not recur."*

| File | Purpose |
|---|---|
| `tasks/lessons.md` | Project-specific learnings: patterns, gotchas, context that matters for this codebase. |
| `CLAUDE.md` | Persistent behavioral rules that apply across sessions and projects. |

**Rule:** Corrections are learning contracts. Every mistake that recurs after being corrected once is a process failure, not a knowledge gap.

### Verification Checkpoints

**After each tool result:** Did the operation succeed? Does the output match expectations? Diagnose root cause before attempting fixes.

**Before presenting code or marking complete:**

1. Re-read every changed file. Check for typos, leftover debug statements, TODO comments.
2. Verify all imports are used and no dead code remains.
3. Confirm naming is consistent across the changeset.
4. Check that error paths are handled, not just the happy path.
5. Ensure the code compiles/runs and tests pass.
6. Run an elegance check (defined below).
7. Ask: "Would a staff engineer approve this?" If uncertain, keep improving.

**Elegance check (required for non-trivial changes).** Verify all four:
- Fewer branches than the previous implementation, or branches justified by edge cases.
- No new dependencies unless removing two or more lines of code per dependency added.
- Diff is the smallest set of changes that implements the spec.
- A junior engineer can read it without flipping to another file.

**Rule:** Never present code you have not re-read. A 30-second review catches the majority of avoidable mistakes.

### Verification-First Development

1. Define the verification method before writing any implementation.
2. Match verification to domain. Backend: test suite. API: curl/integration tests. Frontend: browser/screenshot/a11y. Data: row-count diffs. Infra: terraform plan/smoke tests.
3. Close the loop autonomously. Run verification without being prompted.
4. Invest in reusable verification. Building a fast feedback loop is higher priority than the feature.

**Verification surfaces in this environment:** Playwright MCP for UI, GitHub MCP for repo state, aws-core MCP for cloud verification, Biome for format/lint, project test runner for behavior. Use them.

**Rule:** Code without a verification method is a guess. If you cannot prove the work is correct, the task is not done.

### Incremental Progress

- Get a minimal working version first, then extend.
- Avoid writing large amounts of code before testing any of it.
- Run the full test suite after every file modification.
- Do not assume code is correct without execution.
- Each increment = one red/green/refactor cycle. No second function before the first has a passing test.

---

## Part 2: Code Quality Standards

### Core Principles

1. **Simplicity over cleverness.** Prefer clarity to novelty.
2. **Build small, iterate fast.** Deliver working code before optimizing.
3. **Code for humans.** Readable by a junior engineer without scrolling to other files.
4. **Prefer boring tech.** Stability over hype.
5. **Automate consistency.** Enforce linting, tests, and formatting in CI and hooks, not prose.
6. **Standard lib > external.** Use stdlib unless it requires more than 2x the code.
7. **Solve the problem generally.** Implement the actual logic. Do not hard-code values or write code that only passes the test cases. Tests verify correctness; they do not define the solution.

### Naming & Clarity

- Descriptive names. Avoid `data`, `temp`, single letters.
- Functions ≤ 40 lines with single responsibility.
- Maximum 3 levels of nesting. Use early returns.
- Comments explain WHY, not WHAT.
- Document public APIs with usage examples.
- Limit code files to ~350-400 lines. Split by responsibility.

### Type Safety & Static Analysis

- Type annotations on ALL function signatures (parameters and return types).
- Strict compiler settings (TypeScript `strict`, Python `mypy strict`).
- Typed data structures (interfaces, typed dicts) over untyped maps.
- Run static analysis and type checking as part of the verification workflow.
- Never use `any`, `object`, or escape hatches without a justification comment.

### Structure & Abstraction

- Apply DRY only after 2+ repetitions.
- YAGNI: do not build for hypothetical futures.
- Composition over inheritance.
- Duplicate if it is clearer than abstracting.
- No magic numbers. Use named constants.
- Inject dependencies (I/O, time, randomness).

### Dependency Management

- Pin versions in lockfiles. No floating ranges in production.
- Run `npm audit` / `pip-audit` every CI build. Fail on high-severity findings.
- Add new dependencies deliberately. Evaluate maintenance, license, bundle size.
- Remove unused dependencies promptly.
- Document why non-obvious dependencies exist.

**AI supply-chain risk:** When Claude Code installs dependencies during agentic sessions, treat those changes with the same scrutiny as any other code change. Run `npm audit` or `pip-audit` as part of the PostToolUse hook, not just in CI.

**Rule:** Claude Code can install packages autonomously. Every package it adds is your team's responsibility. Review first, accept second.

---

## Part 3: Testing & Error Handling

### Red/Green/Refactor (NOT OPTIONAL)

| Step | Action |
|---|---|
| 1. RED | Write a test that describes the desired behavior. Run it. Confirm it fails for the right reason — not a syntax error or missing import. |
| 2. GREEN | Write the minimal implementation that makes the test pass. No more, no less. |
| 3. REFACTOR | Extract duplication, improve naming, simplify logic without breaking the test. |
| 4. REPEAT | Each new behavior gets its own red/green/refactor cycle before moving on. |

**Rule:** If you cannot write a failing test first, you do not yet understand the requirement well enough to implement it. Stop and clarify.

- Coverage target: ~80% line coverage (floor, not goal). **100% coverage of all acceptance criteria from the spec.**
- Test naming: behavior-based. `should_return_404_when_user_not_found`, not `test_get_user`.
- Arrange-Act-Assert. One assertion concept per test. Include positive AND negative cases.
- Independent tests. No shared mutable state. Mock external deps at the boundary.
- Unit tests < 100ms each. Move slow tests to integration suites.
- Test behavior, not implementation. Tests should survive internal refactors.

### Error Handling

- Fail fast with clear messages.
- Never swallow exceptions.
- Typed/custom errors for domain-specific failures (not-found ≠ unauthorized ≠ validation-failed).
- Log with context, no secrets.
- Retry transient failures with exponential backoff. Circuit breakers for dependencies.
- Return meaningful error responses: status code + error type + human-readable message.

---

## Part 4: Security

- Validate and sanitize all user inputs.
- Use parameterized queries. No SQL concatenation.
- Apply least-privilege principles.
- Never commit secrets. Rotate regularly.
- Keep dependencies patched and scanned (see AI supply-chain rules in Part 2).

---

## Part 5: Git Workflow

### Commit Standards

```
<type>(<scope>): <description>

[optional body — what and why, not how]

[optional footer — BREAKING CHANGE: / Closes #42]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`

Subject line: imperative mood, lowercase, no period, max 72 characters. Standard workflow: **commit → push → create PR.**

Branch naming: `<type>/<short-description>` → `feat/oauth-login`, `fix/null-payment-response`

### Code Review Standards

**PR size:** ≤ 400 lines of non-generated code, single logical concern. Split larger PRs.

**PR description must include:** what/why, how to test locally, screenshots for UI changes, deferred follow-up linked to ticket.

**Reviewer checks:** spec match | edge cases and error paths | security/perf/observability regressions | readability | meaningful tests | tests written before implementation (check commit order) | dependencies justified.

Respond to review requests within one business day. Use `nit:` or `suggestion:` prefix for non-blocking comments. Approve only when you would be comfortable owning this code if the author left tomorrow.

---

## Part 6: Architecture & Decisions

### Architecture Decision Records (ADRs)

Required when a decision is hard to reverse, affects multiple teams/services, or future engineers will wonder why it was made.

**Location:** `docs/adr/NNNN-short-title.md`

| Field | Content |
|---|---|
| Date | YYYY-MM-DD |
| Status | Proposed \| Accepted \| Deprecated \| Superseded by [NNNN] |
| Deciders | Names or team |
| Context | What situation or problem prompted this decision? |
| Decision | What was decided? State it directly. |
| Consequences | What becomes easier? Harder? Out of scope? |
| Alternatives | What else was evaluated and why was it rejected? |

**Rule:** If you are explaining an architectural choice in a Slack thread or PR comment, that explanation belongs in an ADR instead.

---

## Part 7: Task Management

### Workflow

1. **Plan First.** Write your plan to `tasks/todo.md` with checkable items before touching any code.
2. **Verify Plan.** Check in with the user before starting implementation.
3. **Track Progress.** Mark items complete as you go. Never batch-mark at the end.
4. **Explain Changes.** High-level summary at each significant step.
5. **Document Results.** Add a review section to `tasks/todo.md` when the task is complete.
6. **Capture Lessons.** Update `tasks/lessons.md` after any correction or unexpected outcome.

### Definition of Done (ALL must be true)

**Correctness & Quality**
- [ ] Implementation matches the spec or ticket acceptance criteria.
- [ ] Verification method was defined before coding and passes autonomously.
- [ ] Tests were written BEFORE implementation (red confirmed before green).
- [ ] Each acceptance criterion has at least one corresponding passing test.
- [ ] Refactor step was completed after green (no dead code, no over-fit logic).
- [ ] All new and existing tests pass. Suite runs after every modification.
- [ ] Linting, formatting, and type checking pass with no suppressions.

**Documentation & Process**
- [ ] PR description is complete and reviewable without a verbal walkthrough.
- [ ] New environment variables or config are documented.
- [ ] ADR written if an architectural decision was made.
- [ ] New dependencies audited and locked in the lockfile.
- [ ] Feature flags named, owned, and have a removal date.
- [ ] Accessibility baseline met (if frontend work).

**Rule:** "It works on my machine" is not done. This checklist is done.

> Self-review items (debug statements, dead code, naming, error handling, staff engineer approval) are enforced in Part 1's Verification Checkpoints. They are not duplicated here.

---

## Part 8: Prompt Engineering Standards

### Prompt Structure

| Element | Purpose |
|---|---|
| Role / Context | Tell the model who it is and what it knows. |
| Task | State the goal clearly and specifically. One prompt, one goal. |
| Constraints | What must be true about the output? |
| Anti-goals | What should the output NOT do or include? |
| Output Format | Specify the expected shape of the response. |

### Prompt Patterns

**Spec Prompt — use when starting a feature**
```
You are a [role]. I need a spec for [feature].
Context: [relevant background]
Constraints: [non-negotiables]
Anti-goals: [what this should not do]
Output: spec.md with Goal, Inputs/Outputs, Constraints,
Edge Cases, Acceptance Criteria, Test Stubs.
```

**Implementation Prompt — use after spec approval**
```
Implement [feature] per this spec: [paste spec]
Use [language/framework]. Follow existing patterns in [file].
Do not modify [out-of-scope files].
Follow red/green/refactor: write the failing test first,
confirm it fails, then write minimal implementation to pass.
Solve the problem generally. Do not hard-code to the test cases.
Return only the implementation with inline comments on
non-obvious decisions.
```

**Review Prompt — use for quality checks**
```
Review this code as a skeptical staff engineer.
Report ALL findings. Tag each as BLOCKING, IMPORTANT, or NIT.
Do not filter or self-censor based on perceived severity.
Categories to cover: security, missing error handling,
test gaps, readability, logic implemented before tests,
hard-coded values that should be parameterized.
Do not rewrite the code. Return a structured list of findings.
```

**Debug Prompt — use when diagnosing a failure**
```
This test is failing: [paste test and output]
Here is the relevant implementation: [paste code]
Diagnose the root cause. Do not guess.
Propose one fix with an explanation.
```

**Architecture Prompt — use before writing any code**
```
Before writing any code, analyze [problem area] and identify:
  1. Three implementation approaches with their tradeoffs.
  2. Risks and edge cases for each.
  3. Your recommended approach and why.
Confirm before proceeding with implementation.
```

### Prompt Anti-Patterns

- **Vague goals:** "Make this better" without specifying what better means.
- **Missing constraints:** Prompts with no constraints invite over-engineering.
- **No anti-goals:** Without them, the model expands scope by default.
- **Stacked goals:** One prompt asking for spec, implementation, tests, and docs simultaneously.
- **Implicit context:** Assuming the model knows your project structure or prior decisions.
- **Conversational framing on operational tasks:** "Could you please help me understand..." Write direct commands instead.
- **No exit conditions:** "Keep checking until you find the issue" loops indefinitely. Define outcomes.
- **Implicit "above and beyond":** Opus 4.7 is more literal than older models. If you want a fully-featured implementation, say so explicitly. Default behavior is to do exactly what was asked.
- **Severity self-censorship in reviews:** Telling the model to "be conservative" or "only flag high-severity" causes it to investigate fully but report less. Ask for all findings, tagged by severity.
- **Skipping TDD in the prompt:** Not specifying red/green/refactor invites code-first, tests-after.

**Rule:** A prompt is a spec for the model. Apply the same rigor you would to a spec for code.

---

## Part 9: Claude Code Primitives

Reusable building blocks: slash commands, skills, subagents, and hooks. If you do something more than once a day, it should be one of these — not a prompt you retype.

### Slash Commands (`.claude/commands/`)

Short, repeatable actions checked into git. Executable with a single invocation. Can inline Bash for pre-computed context.

*Examples:* commit-push-PR, run tests, format code, generate changelog.

This document ships with: `/qspec` (generate a spec), `/qcheck` (skeptical code review), `/tdd` (start a red/green/refactor cycle).

### Skills (`.claude/skills/`)

Complex multi-step workflows with domain knowledge or conditional logic. SKILL.md describes when to fire and what to do. Progressive disclosure: skills are folders with `references/`, `scripts/`, `examples/` subdirectories.

*Examples:* analytics queries, incident response, migration playbooks.

**Skill design rules:**
- Skill description is a trigger, not a summary. Write it for the model: "when should I fire?"
- Don't state the obvious. Focus on what pushes Claude out of default behavior.
- Don't railroad with prescriptive step-by-step instructions. Give goals and constraints.
- Include scripts and libraries so Claude composes rather than reconstructs boilerplate.
- Build a Gotchas section in every skill. Add Claude's failure points over time.

### Subagents (`.claude/agents/`)

Opus 4.7 has strong native subagent orchestration. It will delegate appropriately without explicit instruction. Provide well-defined subagent tools and let the model choose.

When you do want to constrain behavior:
- Subagents return concise summaries, not raw output.
- Read-only tools for research subagents. Write access only for implementation subagents.
- Skip subagents for tasks under 3 tool calls. Overhead not worth it.
- Set `isolation: worktree` on agents that modify files.
- Use `model: haiku` for read-only analysis. `sonnet/opus` for architecture reasoning.

**Standard agent files:** `build-validator`, `code-simplifier`, `security-reviewer`, `tdd-enforcer`, `verify-app`.

### Hooks

Hooks enforce mechanically what prose enforces by hope. Every rule moved to a hook is one fewer instruction competing for attention in the context window.

```
PostToolUse (auto-format):    npx biome format --write $CLAUDE_FILE_PATH || true
PostToolUse (audit deps):     npm audit --audit-level=high || exit 1
PostCompact (re-inject):      cat tasks/todo.md tasks/lessons.md
Stop (verification gate):     npm test && npx tsc --noEmit || exit 1
```

**Rule:** If a standard can be enforced by a hook, it should be. Human discipline is a backup, not the primary mechanism.

---

## Part 10: Quick Reference — Red Flags

**Code shape**
- Functions exceeding 40 lines
- More than 3 nesting levels
- Files exceeding 400 lines
- Unused abstractions or commented-out code
- Copy-pasted logic (3+ times requires refactor)
- Hard-coded test values, magic numbers, or solutions that only pass the given tests

**Process**
- Writing code before reading existing patterns
- Implementing without a spec for non-trivial work
- No verification method defined before implementation
- Trial-and-error fixes without root cause analysis
- Pushing through a broken plan instead of re-planning
- Modifying files outside the task's scope
- Ending a session with failing tests or uncommitted changes
- Large uncommitted changes late in context

**Testing & TDD**
- Implementation written before tests for non-trivial logic (covers "skipping red/green confirmation")
- Refactor step skipped after reaching green
- Failing test committed without corresponding implementation
- Acceptance criteria not reflected in any test case

**Quality & types**
- TODOs without ticket links
- Missing type annotations on public interfaces
- Untyped `any` / `object` without justification
- `console.log` / `print` statements in production
- Catching and ignoring exceptions silently

**Process & infra**
- Architectural decisions explained in Slack instead of an ADR
- Feature flags with no owner, date, or removal plan
- Floating dependency versions in production lockfiles
- New dependencies added without review and lockfile verification
- PR exceeding 400 lines across unrelated concerns
- Frontend interactive elements not keyboard-accessible

**Workflow & discipline**
- Ad-hoc subagent prompts for repeated patterns (use `.claude/agents/`)
- Standards enforced by discipline when a hook could automate

---

> "Code should be safe to modify, easy to reason about, and boring to maintain. When in doubt, simplify."
>
> Vinny Carpenter — Document Version 14.0
