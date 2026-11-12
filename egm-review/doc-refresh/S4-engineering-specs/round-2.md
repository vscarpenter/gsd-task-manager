# Doc refresh: S4-engineering-specs, round 2

Status: resolved
Clean round: yes

Scope: the 13 status blocks and the six in-place path corrections from round 1. The spec bodies were out of scope. Two fresh reviewers found no Blocker and no Major, so the loop stops here.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details E | status blocks in spec-vitest-5-migration, spec-bundle-budget, spec-type-system, e2e-testing-spec, spec-phase1-pin-copies, spec-phase2-security, spec-phase3-defects | ran |
| egm-codebase-details F | status blocks in spec-phase5-restructure, spec-pre-rescan-hardening, spec-rescan-high-medium-remediation, spec-audit-findings-remediation, spec-review-remediation-wave-a-b, spec-top-five-audit-risks | ran |

## Findings

### S4-2-1 [E] Severity: Nit
* Target: e2e-testing-spec.md status block
* Finding: "Sync, PWA, and touch specs now exist". No Playwright spec is a PWA spec. The PWA check is `test:pwa` (`package.json:34`, `ci.yml:167`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now says sync and touch specs exist, and CI checks the PWA lifecycle with `bun run test:pwa`.

### S4-2-2 [E] Severity: Nit
* Target: spec-vitest-5-migration.md status block
* Finding: The cited test asserts the two `vitest` pins, not the `@vitest/coverage-v8` pins.
* Decision: PROPOSE FIX
* Reason: `tests/data/security-hardening-scripts.test.ts:399-401`.
* Edit: The block now says the test guards both `vitest` versions.

### S4-2-3 [E] Severity: Nit
* Target: spec-bundle-budget.md status block
* Finding: "Coordinator status poll" is a third name for the `SyncProvider` poll, and `tasks/todo.md` does not record the #558 merge.
* Decision: DECLINE
* Reason: `git log` shows `cb9bc591 perf(sync): stop polling coordinator status while sync is idle (#558)` on `main`. The block uses the commit's words.
* Edit: none

### S4-2-4 [E] Severity: Nit
* Target: spec-bundle-budget.md status block
* Finding: `5a5885cb` may be the head of `main` after four merges, not PR #555's commit.
* Decision: CONTEST
* Reason: `git log` shows `5a5885cb perf(build): add a first-load JavaScript budget and two splits (#555)`.
* Edit: none

### S4-2-5 [F] Severity: Nit
* Target: spec-phase5-restructure.md status block
* Finding: "None of the hooks it names exist", but the shared `useIsHydrated` exists (`lib/use-is-hydrated.ts:10`). The matrix still declares its own (`components/matrix-simplified/index.tsx:46`).
* Decision: PROPOSE FIX
* Reason: Confirmed in round 1.
* Edit: Sentence reworded to say the matrix keeps its own `useIsHydrated` and the new hooks and helpers do not exist.

### S4-2-6 [F] Severity: Nit
* Target: spec-phase5-restructure.md status block
* Finding: `tasks/todo.md` also leaves the bundle E push unticked, so it does not confirm PRs #590 to #594.
* Decision: DECLINE
* Reason: `git log` shows #590 to #594 on `main`, and #589 is the spec PR (`6d3e20b9`).
* Edit: none

### S4-2-7 [F] Severity: Nit
* Target: spec-review-remediation-wave-a-b.md status block
* Finding: ADR 0015 decided the `deletedTasks` key, not ADR 0014.
* Decision: PROPOSE FIX
* Reason: `docs/adr/0014-versioned-backup-envelope.md:9` carries the 2.2.0 amendment; the reviewer cites `docs/adr/0015-trash-with-retention.md:96` for the trash store.
* Edit: Now cites ADRs 0014 and 0015.

### S4-2-8 [F] Severity: Nit
* Target: spec-rescan-high-medium-remediation.md status block
* Finding: The button reads "Schedule" only before the count loads. After that it reads "Schedule is empty" or "Schedule · N tasks".
* Decision: PROPOSE FIX
* Reason: `components/matrix-simplified/matrix-intro.tsx:15-18`.
* Edit: Now says the label starts with "Schedule".
