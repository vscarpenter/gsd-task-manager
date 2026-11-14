# P1/P2 review remediation — 2026-11-14

Status: approved for implementation by the owner in this chat ("Let’s resolve all of the P1 and P2 items").
Tier: non-trivial: browser, MCP, PocketBase and deployment behavior change together.
Base: main at 89ada2812a7062392bfea106bd4ee8bc375a5074.

## Goal and scope

Resolve review items 1–14 with regression coverage. Preserve the approved Inkwell UI,
local-first storage, owner isolation, backup compatibility, and current task limits.
P3 focus restoration is outside scope unless directly required by a changed flow.
No live deployment, cloud writes, push, PR, merge, or native-app repository changes.

## Inputs and outputs

Inputs: browser task changes and backups, queued sync operations, PocketBase task
versions, MCP tool calls, static-export files, and periodic notification events.
Outputs: validated local records, conditional remote mutations, recoverable queue
failures, faithful new task instances, accessible UI actions and safe deployment metadata.

## Acceptance criteria and regression cases

1. A remote update/delete compares its expected version and writes in one server
   transaction. Web and MCP use the guarded contract; stale writes cannot clobber
   concurrent edits, wrong owners cannot mutate records, missing server support
   fails closed, and encryption/validation hooks still execute.
2. Merge/replace import leaves one lifecycle store per id, remaps colliding merge
   ids and references, and preserves omitted legacy stores except contradictory ids.
3. Replace cancels superseded queued intents transactionally, stamps its live
   restores as new edits while sync is enabled, and cannot push an obsolete snapshot.
4. Immutable caching applies only to content-addressed assets. RSC, manifest and
   other stable paths revalidate, including metadata on unchanged existing objects.
5. Deploy keeps previous hashed assets for existing sessions and switches HTML last.
6. Every command-palette open path respects an existing modal; editor drafts survive.
7. Saving commits valid pending subtask text and includes it in discard protection.
8. Failed queue rows can be inspected, retried from current task state or dismissed.
   Recovery is owner-scoped, transactional and never replays stale task snapshots.
9. New recurring/duplicate tasks start with zero tracked work and no running entries.
10. Remote records satisfy the local storage contract before persistence/cursor progress.
11. Estimated/running matrix tasks expose working, error-reporting timer controls.
12. Selecting a global palette result clears the active smart-view filter and reveals it.
13. Periodic notifications evaluate local tasks/settings, respect reminder/quiet/reset
    rules, mark only shown reminders, preserve meaningful badges and avoid duplicate alerts.
14. Production first-load JavaScript meets existing bundle budgets without raising limits.

## Plan

- Batch A: lifecycle-safe import, replacement queue fencing, mapped-record validation,
  and fresh execution state; regression tests first.
- Batch B: transactional PocketBase mutation contract, web/MCP adoption and a real
  disposable PocketBase system test; document backend-first rollout.
- Batch C: safe static deployment/cache policy and focused shell-command tests.
- Batch D: palette, draft, timer and failed-queue UI flows; unit and Playwright tests.
- Batch E: worker reminder engine, generated worker assets and worker/browser tests.
- Batch F: reduce eager bundle cost, run complete checks, review the combined diff,
  update handoff evidence and commit each verified concern.

## Constraints and edge cases

Do not edit production data or require a backend for local use. Missing optional backup
stores remain untouched. Resolve modules before Dexie transactions. Sync work remains
bound to its enabled owner and rejects sign-out/account changes. A replaced queue row
must invalidate any captured push snapshot. Native clients keep their existing API;
server installation instructions must identify the new mutation contract dependency.
Keep low-impact CSS unchanged and use the existing UI primitives. No new dependency
without a concrete need. Do not refresh budgets to hide a regression.

## Verification

Use failing regression tests before fixes. Each batch runs relevant suites; commits
also require the repository pre-commit checks. Final checks: app/MCP coverage, both
typecheck programs, lint, code shape, knip, licenses/audit, builds, bundle budgets,
disposable authenticated PocketBase integration, production CSP/PWA checks, and
browser regressions with fresh contexts, seeded IndexedDB and service workers cleared.
