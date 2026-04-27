---
description: Write a Spec-Driven Development spec for a feature, following coding-standards.md Part 1.
---

Write a spec for the described feature. Follow the Spec-Driven Development standards in `coding-standards.md` Part 1 and the project conventions in `CLAUDE.md`.

Feature: $ARGUMENTS

Include every section:
- **Goal** — One sentence describing what this does and why it matters for gsd-taskmanager.
- **Inputs / Outputs** — Schemas (reference `lib/schema.ts` Zod types if applicable), data shapes, formats.
- **Constraints** — Performance, privacy (local-first IndexedDB), PocketBase sync compatibility, file-size limits (≤350 lines per file, ≤30 lines per function), bundle impact.
- **Edge Cases** — Empty inputs, offline mode, sync conflicts, circular task dependencies, concurrent multi-device edits, schema migration scenarios.
- **Out of Scope** — Explicit list of what this version does NOT do (prevents scope creep).
- **Acceptance Criteria** — Checkable statements that prove correctness. Each AC must map to at least one test.
- **Test Stubs** — Empty test function signatures (vitest, behavior-based names like `should_persist_task_when_quadrant_changes`) mapping to each acceptance criterion.

Save the spec to `tasks/spec.md`. If a spec already exists there, append a new section dated with today's date rather than overwriting.

Do not write any implementation code. Wait for spec approval before proceeding to `/tdd`.
