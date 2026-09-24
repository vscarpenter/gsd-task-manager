---
name: "source-command-qcheck"
description: "Skeptical staff-engineer code review of changed files against coding-standards.md."
---

# source-command-qcheck

Use this skill when the user asks to run the migrated source command `qcheck`.

## Command Template

Review all changed files in this session as a skeptical staff engineer for the gsd-taskmanager codebase. Apply the full `coding-standards.md` and `AGENTS.md` rules.

Run `git status` and `git diff` first to see what has changed. Then evaluate each changed file against:

1. **Standards compliance** — The limits in `coding-standards.md` Part 3 (functions ≤40 lines, files ~400 lines, ≤3 nesting levels, no magic numbers), descriptive naming.
2. **Type safety** — All function signatures typed, no `any` without justification, Zod validation at boundaries (user input, import, MCP tool inputs).
3. **TDD evidence** — Were tests written first? Check git log if uncertain. Each new behavior should have a behavior-named test.
4. **Test quality** — Positive AND negative cases. Coverage ≥80% for changed files. Independent tests (no shared mutable state). Mocks at boundaries, not deep.
5. **Error handling** — Typed errors, no swallowed exceptions, `toast.error()` from sonner instead of `window.alert()`.
6. **Project-specific gotchas**:
   - PocketBase: `client_updated_at` (not `updated`) in sort/filter, `_superusers` admin endpoint, 100ms push throttle, batch lookups not N+1.
   - Schema: `.safeParse()` (not `.parse()`) on user input paths; import uses `.strip()`, export uses `.strict()`.
   - Tests: `bun run test` (not `bun test`); `localStorage.removeItem(key)` (not `clear()`).
   - UI: `toast.error()` (not `alert()`); WCAG AA baseline from `CLAUDE.md` Design Context.
7. **Security** — Input validation, no committed secrets, parameterized queries, least privilege.
8. **Observability** — Structured logging via `lib/logger.ts`, no `console.*` in production paths, no PII in logs.
9. **Exit checklist** — Every box for the task's tier in `coding-standards.md` Part 7 "Tiered Exit Checklists".

Distinguish blocking issues from suggestions. Prefix non-blocking comments with `nit:` or `suggestion:`.

Do not rewrite the code. Return a structured list of findings, organized by file, with `file:line — issue — fix`.
