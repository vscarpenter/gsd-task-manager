# Code Standards & Agentic Guidance

*Comprehensive guidance for AI-assisted development*

---

## Part 1: Agentic Behavior Guidelines

These directives govern how LLMs approach complex, multi-step tasks requiring sustained autonomous work. Every directive in this section is actionable and applies to every coding session.

### Codebase Orientation (Read Before Write)

Before writing any code in an existing project, YOU MUST understand the landscape:

1. Read the project's README, CLAUDE.md, and any CONTRIBUTING docs first.
2. Explore the directory structure to understand the project layout.
3. Identify existing patterns: naming conventions, module organization, error handling style, test structure.
4. Check for existing utilities, helpers, or shared modules before creating new ones.
5. Match the existing code style exactly, even if it differs from these standards.

> **Rule:** The existing codebase is the primary style guide. These standards apply to greenfield code or when explicitly refactoring.

### Spec-Driven Development

For any non-trivial task, write a spec before writing code. The spec is the acceptance contract.

1. **Write the spec first.** Create `tasks/spec.md` before any implementation begins.
2. **Define the contract.** Include: inputs, outputs, constraints, edge cases, and what success looks like.
3. **State the anti-goals.** Explicitly list what this implementation does NOT do. This prevents scope creep.
4. **Get approval.** Do not start coding until the spec is reviewed and confirmed.
5. **Treat drift as a failure.** If implementation deviates from the spec, update the spec first and get re-confirmation.

A minimal spec includes:
- **Goal:** One sentence describing what this does and why.
- **Inputs / Outputs:** What goes in, what comes out, what format.
- **Constraints:** Performance, security, compatibility, or size requirements.
- **Edge Cases:** Empty inputs, nulls, concurrent calls, failure modes.
- **Out of Scope:** Explicit list of what this version does not handle.
- **Acceptance Criteria:** Checkable statements that prove the implementation is correct.

> **Rule:** Code written without a spec is a guess. A spec written after the code is a rationalization. Write it first.

### Handling Ambiguity

When requirements are unclear or incomplete:

1. **Ask before assuming.** If a requirement has multiple valid interpretations, ask which one is intended rather than guessing.
2. **State your assumptions.** If you must proceed without clarification, explicitly list every assumption you are making.
3. **Prefer reversible choices.** When guessing, choose the option that is easiest to change later.
4. **Flag scope questions early.** If a task might touch shared code, external APIs, or infrastructure, confirm scope before modifying anything.

> **Never:** Silently interpret ambiguous requirements and build an entire solution on an assumption that could be wrong.

### Context Management & Sustained Work

For lengthy tasks, YOU MUST follow these requirements:

1. Before writing code, outline your implementation plan with clear milestones and acceptance criteria for each.
2. Work systematically through each milestone, committing functional changes frequently.
3. Commit at least every significant component or logical unit of work.
4. Monitor your context usage and prioritize committing working code before context exhaustion.
5. Never leave significant work uncommitted.

> **Critical:** If you find yourself 80% through context with major uncommitted work, stop adding features and commit immediately.

**Compaction Directive:** When compacting, always preserve the full list of modified files, current task status, test commands, and next steps. Do not discard working state during summarization.

### Session Handoff Protocol

Every session must end in a state another session can resume from without asking questions.

**Before ending a session:**
1. Commit all working code. Do not leave meaningful work uncommitted.
2. Update `tasks/todo.md` with a clear "Resuming From Here" section: what was completed, what is next, and any blockers.
3. Note any assumptions made during the session that future work depends on.
4. Run the test suite. Do not end with failing tests.

**When starting a new session:**
1. Read CLAUDE.md and `tasks/lessons.md` before doing anything else.
2. Read `tasks/todo.md` to orient on current state and next steps.
3. Check git log for the last 3-5 commits to understand recent context.
4. Do not ask the user to re-explain context that is captured in these files.

> **Rule:** A clean handoff is as important as clean code. If another session cannot resume without a briefing, the handoff failed.

### Re-Planning Trigger

Plans break. When they do, stop immediately:

- If execution goes sideways at any point, STOP and re-plan before continuing.
- Do not push through ambiguity or compounding errors by guessing forward.
- Use plan mode for verification steps, not just initial building.

> **Rule:** A bad plan executed confidently causes more damage than pausing to re-plan. Stop early, re-plan explicitly, then proceed.

### Self-Improvement Loop

After any correction from the user, YOU MUST:

1. Capture the pattern in `tasks/lessons.md` immediately. Do not defer it.
2. Write an explicit rule that prevents the same mistake from recurring.
3. Iterate ruthlessly on these lessons until the mistake rate drops.
4. At the start of each session for a relevant project, review `tasks/lessons.md` before writing any code.

**Two-layer learning — project lessons and persistent rules:**
- `tasks/lessons.md` captures project-specific learnings: patterns, gotchas, and context that matter for this codebase.
- `CLAUDE.md` captures persistent behavioral rules that apply across sessions and across projects. After every correction, end with: "Update CLAUDE.md so this mistake does not recur." Claude is effective at writing rules for itself when prompted.

**Compounding Engineering — learn during code review:**
When reviewing PRs (or receiving review feedback), tag `@.claude` in PR comments to add learnings directly to `CLAUDE.md` as part of the PR itself. This turns review feedback into permanent, machine-readable rules without a separate manual step.

Example PR comment:
```
nit: use a string literal union, not a TS enum

@claude add to CLAUDE.md to never use enums, always prefer literal unions
```

**Auto-Memory as a safety net:**
Enable Claude Code's auto-memory (`/memory`) to capture preferences and corrections that you forget to write down manually. Use `/dream` periodically to consolidate and clean accumulated memory, removing outdated assumptions and merging overlapping notes.

> **Rule:** Corrections are learning contracts. Every mistake that recurs after being corrected once is a process failure, not a knowledge gap. `tasks/lessons.md` is the project memory. `CLAUDE.md` is the behavioral memory. Both must stay current.

### Reflection After Tool Results

After each tool result, pause to evaluate before proceeding:

- Did the operation succeed or fail?
- Does the output match expectations?
- Are there edge cases or errors to address?
- What is the root cause if results are unexpected?

Use extended thinking to analyze results and plan your next action. If results are unexpected, diagnose the root cause before attempting fixes. Avoid repeated trial-and-error changes without understanding the underlying issue.

### Verification-First Development

Verification is not an afterthought; it is the single most important factor in output quality. Before writing any implementation, define how Claude will verify that the work is correct. A feedback loop that Claude can run autonomously will 2-3x the quality of the final result.

1. **Define the verification method before coding.** For every non-trivial task, state upfront how correctness will be proven: a test suite, a bash command, a simulator, a browser check, or a diff against expected output.
2. **Match verification to the domain.** Different work requires different proof:
   - **Backend logic:** Unit and integration tests, run automatically after each change.
   - **API changes:** curl/httpie commands or integration tests that exercise the endpoint.
   - **Frontend/UI:** Browser testing (e.g., Claude Chrome extension), screenshot comparison, or accessibility audit.
   - **Data pipelines:** Row-count checks, sample-output diffs, schema validation.
   - **Infrastructure:** `terraform plan`, dry-run deploys, or smoke tests against a staging environment.
3. **Close the loop autonomously.** Claude should run verification without being prompted. If the verification fails, diagnose and fix before presenting results.
4. **Invest in reusable verification.** If a project lacks a fast feedback loop, building one is a higher priority than the feature itself. A 30-second test suite pays for itself within the first session.

> **Rule:** Code without a verification method is a guess. If Claude cannot prove the work is correct, the task is not done.

### Solution Quality Requirements

Every solution YOU MUST meet these standards:

- Implement robust, general-purpose logic that handles all valid inputs correctly.
- Avoid hardcoded values, magic numbers, or logic tailored to specific test inputs.
- Include appropriate error handling and input validation.
- Use standard tools and language features rather than external workarounds.
- Code should be maintainable, readable, and follow established conventions.

For non-trivial changes, pause before presenting and ask: "Is there a more elegant way?" If the current solution feels hacky or over-fitted, implement the cleaner version instead. Skip this check for obvious, simple fixes. Apply it whenever the change touches architecture, shared modules, or multiple files.

> **Never:** Create solutions that only work for specific test cases. Always implement the actual algorithm or business logic.

### Self-Review Before Presenting

Before presenting code or marking a task as complete, perform a quick self-review:

1. Re-read every changed file. Look for typos, leftover debug statements, and TODO comments.
2. Verify all imports are used and no dead code remains.
3. Confirm naming is consistent across the changeset.
4. Check that error paths are handled, not just the happy path.
5. Ensure the code compiles/runs and tests pass.
6. Ask yourself: "Would a staff engineer approve this?" If the answer is uncertain, keep improving.

> **Rule:** Never present code you have not re-read. A 30-second review catches the majority of avoidable mistakes.

### Autonomous Bug Fixing

When given a bug report, fix it without requiring hand-holding:

- Point at logs, errors, and failing tests. Then resolve them.
- Zero context switching required from the user.
- Go fix failing CI tests without being told how.
- Do not ask for step-by-step guidance on a bug you can diagnose yourself.

> **Rule:** A bug report is a complete work order. Read the signals, identify the root cause, fix it, verify it.

### Incremental Progress

Build incrementally to ensure quality:

- Get a minimal working version first, then extend.
- Avoid writing large amounts of code before testing any of it.
- Run the full test suite after every file modification and fix failures before proceeding.
- Do not assume code is correct without execution.
- If tests fail, analyze the failure and diagnose root cause before making changes.

---

## Part 2: Code Quality Standards

### Core Principles

1. **Simplicity over cleverness.** Prefer clarity to novelty.
2. **Build small, iterate fast.** Deliver working code before optimizing.
3. **Code for humans.** Code must be readable by a junior engineer without needing to scroll to other files.
4. **Prefer boring tech.** Stability over hype.
5. **Automate consistency.** Enforce linting, tests, and formatting in CI.
6. **Standard Lib > External:** Always choose the language's standard library over an external dependency unless the standard library requires >2x the amount of code to achieve the same result.

### Naming & Clarity

- Use descriptive names; avoid generic terms like 'data', 'temp', or single letters.
- Functions should be 30 lines or fewer with single responsibility.
- Maximum 3 levels of nesting; use early returns.
- Comments explain WHY, not WHAT.
- Document public APIs with usage examples.
- Limit code files to approximately 350-400 lines; split by responsibility.

### Type Safety & Static Analysis

- Add type annotations to all function signatures (parameters and return types).
- Use strict/strict-mode compiler settings where available (TypeScript strict, Python mypy strict).
- Prefer typed data structures (interfaces, typed dicts, structs) over untyped maps or generic objects.
- Run static analysis and type checking as part of the verification workflow.
- Never use `any`, `object`, or equivalent escape hatches without a comment explaining why.

### Structure & Abstraction

- Apply DRY only after 3+ repetitions.
- Follow YAGNI: do not build for hypothetical futures.
- Prefer composition over inheritance.
- Duplicate if it is clearer than abstracting.
- No magic numbers; use named constants.
- Inject dependencies (I/O, time, randomness).

### Performance Awareness

Do not prematurely optimize, but do not write obviously inefficient code either:

- Choose appropriate data structures (use a Set for lookups, not an Array scan).
- Be aware of algorithmic complexity; avoid O(n^2) when O(n) or O(n log n) is straightforward.
- Watch for N+1 query patterns in database access.
- Avoid unnecessary allocations in hot paths (loops, event handlers).
- Profile before optimizing; measure, do not guess.
- Document any intentional performance tradeoffs.

### File Boundaries

- Do not modify files outside the current working directory without explicit permission.
- Do not edit configuration files, CI/CD pipelines, or infrastructure code unless the task specifically requires it.
- When uncertain about scope, ask before modifying files in shared or upstream directories.

### Configuration Management

- Use environment variables for deployment-specific values (URLs, ports, feature flags).
- Provide sensible defaults for local development; never require manual setup to run locally.
- Separate config from code: no inline connection strings, API keys, or endpoint URLs.
- Use a single config module/file per service as the source of truth.
- Document every environment variable with its purpose, type, and default value.

### Dependency Management

- Pin dependency versions in lockfiles; never rely on floating ranges in production.
- Run `npm audit`, `pip-audit`, or equivalent on every CI build; fail on high-severity findings.
- Add new dependencies deliberately: evaluate maintenance status, license, and bundle size before adding.
- Remove unused dependencies promptly; dead packages accumulate security debt.
- Document why non-obvious dependencies exist (a comment in package.json or requirements.txt is enough).
- Schedule a recurring dependency audit; do not let major versions drift more than one cycle behind.

### Feature Flags

- Use feature flags to decouple deployment from release.
- Name flags descriptively: `enable_new_payment_flow`, not `flag_v2`.
- Every flag must have an owner, a creation date, and a planned removal date documented in code or config.
- Remove flags promptly after full rollout or rollback. Stale flags are tech debt.
- Never gate security fixes or critical bug fixes behind a feature flag.
- Default new flags to `false` (opt-in), not `true` (opt-out), unless the use case requires otherwise.

### Accessibility Baseline

All user-facing frontend work must meet these minimum standards:

- Use semantic HTML elements (`button`, `nav`, `main`, `label`) instead of generic `div` and `span` where appropriate.
- Every interactive element must be keyboard-accessible and focusable.
- All images require descriptive `alt` text; decorative images use `alt=""`.
- Color alone must not convey meaning; pair color with text or iconography.
- Maintain a minimum contrast ratio of 4.5:1 for normal text (WCAG AA).
- Form inputs must have associated `label` elements; do not rely on placeholder text alone.

> **Rule:** Accessibility is not a post-launch audit item. It is a build-time requirement.

### Logging & Observability

- Use structured logging (JSON format preferred) with consistent field names.
- Include correlation/request IDs for tracing across service boundaries.
- Log at appropriate levels: ERROR for failures requiring attention, WARN for degraded states, INFO for significant business events, DEBUG for development.
- Never log secrets, tokens, passwords, or PII.
- Include enough context to diagnose issues without reproducing them: what operation, what input (sanitized), what outcome.

### Subagents

- Use subagents liberally to keep main context window clean and focused.
- Offload research, exploration, file analysis, and codebase scanning to subagents.
- For complex problems, use parallel subagents for independent analysis tasks.
- Chain subagents sequentially when tasks have dependencies (plan > implement > test).
- One well-defined task per subagent for focused execution.
- Subagents MUST return concise summaries, not raw output, to preserve main context.
- Use read-only tools (Read, Grep, Glob) for research subagents; grant write access only to implementation subagents.
- Do not use subagents for tasks that take fewer than 3 tool calls; the overhead is not worth it.
- During implementation, delegate tasks to available subagents based on their expertise:
  - Use Explore subagent for codebase scanning, pattern discovery, and reading files.
  - Use general-purpose subagent for multi-step implementation tasks requiring file modifications.
  - Use dedicated review subagents for code quality, security, and test coverage checks.

**Custom Agents Directory:**
For subagent patterns your team uses repeatedly, define them as reusable agent files in `.claude/agents/`. Each agent gets a name, model, tool permissions, and a focused system prompt. This eliminates ad-hoc subagent prompts and ensures consistent behavior across sessions and team members.

```
.claude/
  agents/
    build-validator.md    # Runs build + tests, reports failures
    code-simplifier.md    # Reviews code for unnecessary complexity
    security-reviewer.md  # Scans for common vulnerability patterns
    verify-app.md         # End-to-end verification instructions
```

Example agent definition (`.claude/agents/code-simplifier.md`):
```yaml
---
name: code-simplifier
model: sonnet
isolation: worktree
---
Review all changed files for unnecessary complexity, duplicated logic,
and opportunities to reuse existing utilities. Do not rewrite code;
return a structured list of findings with file, line, and recommendation.
```

**Key practices:**
- Check agent definitions into git so the entire team benefits.
- Set `isolation: worktree` on agents that modify files to prevent interference with the main session.
- Use `model: haiku` for read-only analysis agents and `model: sonnet` or `model: opus` for agents that reason about architecture.
- Set a default agent for your project via `"agent"` in `settings.json` when your team has a standard workflow.

### Hooks for Automated Quality Gates

Use Claude Code hooks to enforce standards deterministically rather than relying on discipline alone. Hooks fire at specific points in Claude's lifecycle and run your commands automatically.

**PostToolUse — Auto-Format on Every Write:**
Claude generates well-formatted code most of the time, but a PostToolUse hook catches edge cases before they reach CI. Configure it to run your project's formatter after every file write or edit:

```json
"hooks": {
  "PostToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "npx biome format --write $CLAUDE_FILE_PATH || true"
        }
      ]
    }
  ]
}
```

Replace the format command with your project's tool (`prettier`, `black`, `gofmt`, etc.). The `|| true` ensures a formatter warning does not block Claude's workflow.

**PostCompact — Re-Inject Critical Context After Compaction:**
When Claude compresses its conversation context, critical instructions can be lost. Use a PostCompact hook to re-inject essentials automatically. This is the enforcement mechanism for the Compaction Directive above:

```json
"hooks": {
  "PostCompact": [
    {
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "cat tasks/todo.md tasks/lessons.md 2>/dev/null || echo 'No task files found.'"
        }
      ]
    }
  ]
}
```

**Stop Hook — Verification Gate for Long-Running Tasks:**
For autonomous, long-running work, use a Stop hook to run deterministic checks (test suite, linter, type checker) before Claude declares a task complete. This ensures Claude cannot mark work as done without passing the verification gate.

> **Rule:** If a standard can be enforced by a hook, it should be. Human discipline is a backup, not the primary mechanism.

---

## Part 3: Testing & Error Handling

### Testing Standards

- Write tests BEFORE implementation when feasible (TDD approach).
- Test all public APIs and critical paths (target approximately 80% coverage).
- Use clear behavior-based test names (e.g., `should_return_404_when_user_not_found`).
- Follow Arrange-Act-Assert pattern.
- Include positive and negative cases.

### Test Isolation & Strategy

- Each test must be independent; no shared mutable state between tests.
- Mock external dependencies (network, filesystem, databases) at the boundary, not deep in the call stack.
- Prefer fakes and in-memory implementations over mocks when feasible.
- Keep unit tests fast (< 100ms each); move slow tests to integration suites.
- Use factory functions or builders for test data; never copy-paste fixture objects.
- Test behavior, not implementation; tests should survive internal refactors.

### Error Handling

- Fail fast with clear messages.
- Never swallow exceptions.
- Use typed/custom errors for domain-specific failures (distinguish "not found" from "unauthorized" from "validation failed").
- Log with context (no secrets).
- Retry transient failures with exponential backoff; use circuit breakers for dependencies.
- Return meaningful error responses to callers: status code, error type, human-readable message.

---

## Part 4: Security

- Validate and sanitize all user inputs.
- Use parameterized queries (no SQL concatenation).
- Apply least-privilege principles.
- Never commit secrets; rotate regularly.
- Keep dependencies patched and scanned.

---

## Part 5: Git Workflow

### Commit Standards

For git operations: when asked to commit and push, write a descriptive conventional commit message, bump the version if appropriate, and create a PR unless told otherwise.

**Standard workflow:** commit, push, create PR.

**Conventional commit format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`

**Examples:**
```
feat(auth): add OAuth2 login flow
fix(api): handle null response from payment provider
refactor(utils): extract date formatting into shared module
docs(readme): add local development setup instructions
```

**Rules:**
- Subject line: imperative mood, lowercase, no period, max 72 characters.
- Body: explain what and why, not how.
- Breaking changes: add `BREAKING CHANGE:` in footer or `!` after type.
- Reference issues when applicable: `Closes #42`.

### Branch Naming

Use the format: `<type>/<short-description>` (e.g., `feat/oauth-login`, `fix/null-payment-response`).

### Code Review Standards

**PR size:** Keep PRs focused. A PR that touches more than 400 lines of non-generated code or crosses more than one logical concern should be split.

**PR description must include:**
- What this changes and why (not just what the commit messages say).
- How to test it locally.
- Screenshots or output samples for UI or behavioral changes.
- Any follow-up work this defers, linked to a ticket.

**As a reviewer, check for:**
1. Does this match the spec or ticket intent? Reject scope creep.
2. Are edge cases and error paths handled?
3. Does this introduce security, performance, or observability regressions?
4. Is the code readable without the author explaining it?
5. Are tests present, meaningful, and not testing implementation details?
6. Are new dependencies justified?

**Review norms:**
- Respond to review requests within one business day.
- Distinguish blocking concerns from suggestions: prefix non-blocking comments with `nit:` or `suggestion:`.
- Approve only when you would be comfortable owning this code if the author left tomorrow.
- Do not merge your own PR without at least one approval, except for hotfixes with immediate rollback coverage.

---

## Part 6: Architecture & Decisions

### Architecture Decision Records (ADRs)

Capture significant architectural decisions in `docs/adr/` using the format below. An ADR is required whenever a decision is hard to reverse, affects multiple teams or services, or future engineers will wonder why it was made.

**File naming:** `docs/adr/NNNN-short-title.md` (e.g., `0012-use-postgres-for-session-storage.md`)

**Required fields:**

```markdown
# NNNN: [Title]

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Deprecated | Superseded by [NNNN]
**Deciders:** [Names or team]

## Context
What situation or problem prompted this decision?

## Decision
What was decided? State it directly.

## Consequences
What becomes easier? What becomes harder? What is now out of scope?

## Alternatives Considered
What else was evaluated and why was it rejected?
```

> **Rule:** If you are explaining an architectural choice in a Slack thread or PR comment, that explanation belongs in an ADR instead. Write it once where everyone can find it.

---

## Part 7: Task Management

Every non-trivial task follows this workflow. Deviating from it is a process failure.

1. **Plan First:** Write your plan to `tasks/todo.md` with checkable items before touching any code.
2. **Verify Plan:** Check in with the user before starting implementation.
3. **Track Progress:** Mark items complete as you go; never batch-mark at the end.
4. **Explain Changes:** Provide a high-level summary at each significant step.
5. **Document Results:** Add a review section to `tasks/todo.md` when the task is complete.
6. **Capture Lessons:** Update `tasks/lessons.md` after any correction or unexpected outcome.

> **Rule:** `tasks/todo.md` is the live record of intent and progress. `tasks/lessons.md` is the accumulated process memory. Both files must stay current.

### Definition of Done

A task is not done when the code works. It is done when ALL of the following are true:

**Correctness & Quality:**
- [ ] The implementation matches the spec or ticket acceptance criteria.
- [ ] Verification method was defined before coding and passes autonomously.
- [ ] All new and existing tests pass; test suite runs after every modification.
- [ ] Linting, formatting, and type checking pass with no suppressions.
- [ ] Type annotations present on all function signatures.
- [ ] Elegance check performed for non-trivial changes ("Is there a more elegant way?").

**Self-Review:**
- [ ] Code has been self-reviewed (no debug statements, dead code, or unresolved TODOs).
- [ ] Self-explanatory names; understandable in 5 minutes without a walkthrough.
- [ ] Comprehensive error handling with typed errors; not just the happy path.
- [ ] "Would a staff engineer approve this?" answered with confidence.

**Documentation & Process:**
- [ ] PR description is complete and reviewable without a verbal walkthrough.
- [ ] `tasks/todo.md` reflects the completed state.
- [ ] Any new environment variables or config are documented.
- [ ] Observability is adequate: structured logging covers the new path, errors surface correctly.
- [ ] If an ADR was warranted, it has been written.
- [ ] If a lesson was learned, `tasks/lessons.md` and/or `CLAUDE.md` have been updated.
- [ ] If new dependencies were added, they have been audited.
- [ ] If feature flags were introduced, they are named, owned, and have a removal date.
- [ ] If frontend work, accessibility baseline is met.

> **Rule:** "It works on my machine" is not done. This checklist is done.

---

## Part 8: Prompt Engineering Standards

Writing good prompts is a skill with the same rigor as writing good code. These standards apply when crafting prompts for AI-assisted development tasks.

### Prompt Structure

Every substantive prompt should include:

1. **Role or context:** Tell the model who it is and what it knows. ("You are a senior TypeScript engineer working on a Next.js API route...")
2. **Task:** State the goal clearly and specifically. One prompt, one goal.
3. **Constraints:** What must be true about the output? ("Do not modify the existing auth middleware. Stay under 50 lines.")
4. **Anti-goals:** What should the output NOT do or include? This prevents unwanted scope.
5. **Output format:** Specify the expected shape. ("Return only the updated function, no explanation.")

### Prompt Patterns

**Spec prompt:** Use when starting a feature.
```
You are a [role]. I need a spec for [feature].
Context: [relevant background]
Constraints: [non-negotiables]
Anti-goals: [what this should not do]
Output: A spec in markdown with Goal, Inputs/Outputs, Constraints, Edge Cases, and Acceptance Criteria.
```

**Implementation prompt:** Use after spec approval.
```
Implement [feature] per this spec: [paste spec]
Use [language/framework]. Follow the existing patterns in [file or module].
Do not modify [out-of-scope files].
Return only the implementation with inline comments explaining non-obvious decisions.
```

**Review prompt:** Use for quality checks.
```
Review this code as a skeptical staff engineer.
Flag: security issues, missing error handling, test gaps, readability problems.
Distinguish blocking issues from suggestions.
Do not rewrite the code; return a structured list of findings.
```

**Debug prompt:** Use when diagnosing a failure.
```
This test is failing: [paste test and output]
Here is the relevant implementation: [paste code]
Diagnose the root cause. Do not guess. Propose one fix with an explanation.
```

### Prompt Anti-Patterns

Avoid these patterns; they produce lower-quality outputs:

- **Vague goals:** "Make this better" without specifying what better means.
- **Missing constraints:** Prompts with no constraints invite over-engineering.
- **No anti-goals:** Without them, the model expands scope by default.
- **Stacked goals:** One prompt asking for spec, implementation, tests, and documentation simultaneously.
- **Implicit context:** Assuming the model knows your project structure, conventions, or prior decisions without stating them.

> **Rule:** A prompt is a spec for the model. Apply the same rigor you would to a spec for code.

---

## Part 9: Reusable Skills & Slash Commands

### Formalize Repeated Workflows

If you do something more than once a day, it should be a skill or a slash command — not a prompt you retype or copy-paste.

**Slash commands** live in `.claude/commands/` and are checked into git. They are shared with the entire team and executable with a single `/command-name` invocation. Slash commands can include inline Bash to pre-compute context (like `git status` or `git diff --stat`) so Claude has the information it needs without extra model calls.

**Skills** live in `.claude/skills/` and provide deeper, multi-step workflow guidance. Use skills for domain-specific patterns that require detailed instructions (e.g., how to run a specific test harness, how to deploy to staging, how to generate a particular report format).

**When to create which:**
- **Slash command:** Short, repeatable action (commit-push-PR, run tests, format code, generate a changelog).
- **Skill:** Complex workflow with multiple steps, domain knowledge, or conditional logic (analytics queries, incident response, migration playbooks).

**Team practice:**
- Check all commands and skills into the repo under `.claude/`.
- Review them in PRs like any other code; stale commands accumulate confusion.
- Use the `/simplify` pattern after implementation: append a quality-review command to any prompt to run parallel agents that check for reuse, quality, and efficiency in one pass.

**Companion slash commands:**
This skill ships with `/qspec` (generate a spec) and `/qcheck` (skeptical code review) in `.claude/commands/`. These are the formalized, version-controlled replacements for inline prompt shortcuts.

---

## Part 10: Quick Reference

### Prompt Template

Use this template when requesting features:

```
Build [feature] that:
  - Uses clear naming
  - Validates inputs, handles errors
  - Includes tests for core cases
  - Follows [framework] conventions
  - Avoids premature abstraction
  - Keeps functions <30 lines
```

### Red Flags

- Functions exceeding 40 lines
- More than 3 nesting levels
- Unused abstractions or commented-out code
- TODOs without ticket links
- Copy-pasted logic (3+ times requires refactor)
- Hardcoded test values or magic numbers
- Trial-and-error fixes without root cause analysis
- Large uncommitted changes late in context
- Modifying files outside the task's scope
- Missing type annotations on public interfaces
- Untyped `any` or `object` without justification comment
- console.log / print statements left in production code
- Catching and ignoring exceptions silently
- Writing code before reading existing patterns in the codebase
- Pushing through a broken plan instead of stopping to re-plan
- Recurring mistakes not captured in `tasks/lessons.md`
- Asking the user for step-by-step guidance on a diagnosable bug
- Implementing without a spec for non-trivial work
- Ending a session with failing tests or uncommitted changes
- Architectural decisions explained in Slack instead of an ADR
- Feature flags with no owner, no date, and no removal plan
- Floating dependency versions in production lockfiles
- PR that exceeds 400 lines across unrelated concerns
- Frontend interactive elements that are not keyboard-accessible
- No verification method defined before starting implementation
- Ad-hoc subagent prompts instead of reusable agent definitions for repeated patterns
- Standards enforced by discipline alone when a hook could automate them

### Guiding Principle

> *Code should be safe to modify, easy to reason about, and boring to maintain. When in doubt, simplify.*

---

*Document Version 10.0 | Vinny Carpenter*
