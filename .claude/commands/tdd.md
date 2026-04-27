---
description: Start a red/green/refactor cycle for a behavior. Enforces test-first discipline per coding-standards.md.
---

Start a red/green/refactor cycle for the behavior described in the arguments. Follow the TDD protocol from `coding-standards.md` Part 3 and the gsd-taskmanager testing conventions in `CLAUDE.md`.

Behavior: $ARGUMENTS

Execute the cycle strictly in order:

1. **Red.** Write a failing test in the appropriate location:
   - Data/logic tests → `tests/data/`
   - UI/component tests → `tests/ui/`
   - MCP server tests → `packages/mcp-server/tests/`

   Use a behavior-based name (e.g., `should_skip_echo_events_from_own_device`). Follow Arrange-Act-Assert. Use the project conventions:
   - Vitest with `@testing-library/react` + `@testing-library/jest-dom`
   - Mock IndexedDB is auto-imported via `vitest.setup.ts`
   - Use `localStorage.removeItem(key)` for cleanup, not `localStorage.clear()`
   - For sync tests, use the `vi.mock('pocketbase')` pattern from existing sync tests

   Run `bun run test -- <test-file>` (NOT `bun test`) and confirm it fails for the right reason — not a syntax error, missing import, or typo. Report the failure output.

2. **Pause.** Stop and wait for approval of the test before writing any implementation. Do not proceed to green without confirmation.

3. **Green.** Write the minimum implementation needed to make the test pass. Respect:
   - File-size limit ≤350 lines (split if needed; `lib/analytics/`, `lib/notifications/`, `lib/sync/`, `components/task-form/`, `components/settings/`, `components/dashboard/` are reference modular layouts)
   - Function-size limit ≤30 lines
   - No extra features, no speculative abstractions, no unrelated edits

   Run the test and confirm it passes. Then run `bun run test` to confirm no regressions.

4. **Refactor.** Propose a refactor pass: extract duplication, improve naming, simplify logic. Do not change behavior. Wait for confirmation before applying.

5. **Repeat.** If the behavior requires multiple cycles, state the next failing test and return to step 1.

Rules:
- Do not write implementation code before the test exists and has been confirmed to fail.
- Do not bundle multiple behaviors into one cycle.
- If touching `lib/sync/**`, also invoke the `pb-sync-reviewer` subagent before the refactor step.
- If touching components in `components/`, also invoke the `a11y-reviewer` subagent before the refactor step.
- If you cannot write a failing test first, stop and say the requirement is unclear — invoke `/qspec` instead.
