# Doc refresh: H1-html, round 5

Status: resolved
Clean round: no

Round 5 is the cap. `docs/architecture.html` was clean in rounds 4 and 5. `docs/cloud-sync-explainer.html` drew two Majors this round, so the batch did not converge. No fresh reviewer has checked this round's fixes.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | docs/architecture.html | ran, 0 Blocker, 0 Major, 6 Nit |
| egm-codebase-details | docs/cloud-sync-explainer.html | ran, 0 Blocker, 2 Major, 4 Nit |

ARCH is `docs/architecture.html`, SYNC is `docs/cloud-sync-explainer.html`.

## Findings: docs/architecture.html

### H1-html-5-1 [codebase-details] Severity: Nit
* Target: ARCH line 370
* Finding: The runtime cache is an allowlist (`lib/sw-cache-logic.ts:58-65`), not "other static".
* Decision: DECLINE
* Reason: The card matches `.claude/rules/sw-cache.md`, which has the same wording. Fix both together in the rules batch.
* Edit: none

### H1-html-5-2 [codebase-details] Severity: Nit
* Target: ARCH line 607
* Finding: The ADR-0008 card says BFS prevents cycles. `lib/tasks/dependencies.ts` `addDependency` does not call the check. Only the edit drawer does.
* Decision: ESCALATE
* Reason: CLAUDE.md states the rule "Always validate circular dependencies before adding relationships". The document may be right and the code short. Listed under possible code defects.
* Edit: none

### H1-html-5-3 [codebase-details] Severity: Nit
* Target: ARCH line 252
* Finding: `not-found.tsx` has no AppShell.
* Decision: DECLINE
* Reason: Same as H1-html-2-4. It is not a route page.
* Edit: none

### H1-html-5-4 [codebase-details] Severity: Nit
* Target: ARCH lines 415, 611
* Finding: The web app cannot create a custom smart view. Import is the only writer to `smartViews`.
* Decision: DECLINE
* Reason: The cell says what the table holds, which is correct. ADR 0009 carries the detail.
* Edit: none

### H1-html-5-5 [codebase-details] Severity: Nit
* Target: ARCH line 431
* Finding: `timeEntries` shape omits `id`.
* Decision: DECLINE
* Reason: `lib/schema.ts` holds the full shape, and the card now points there.
* Edit: none

### H1-html-5-6 [codebase-details] Severity: Nit
* Target: ARCH line 162
* Finding: "app version 9" with no current version on the page.
* Decision: DECLINE
* Reason: A current version number would drift with every release.
* Edit: none

## Findings: docs/cloud-sync-explainer.html

### H1-html-5-7 [codebase-details] Severity: Major
* Target: SYNC lines 811-812
* Finding: "if a 429 still slips through we abort the push loop". A 429 on the per-row lookup does not abort. `fetchRemoteTaskEntry` returns `fetchSucceeded: false` (`pb-sync-helpers.ts:251-257`), the row loses one attempt, and the loop continues.
* Decision: PROPOSE FIX
* Reason: Confirmed in the helper. `lib/sync/README.md` states the same behaviour.
* Edit: The gotcha now says a write 429 aborts the loop, and a lookup 429 costs the row one attempt while the loop continues.

### H1-html-5-8 [codebase-details] Severity: Major
* Target: SYNC line 854
* Finding: The local dev tip omits `GSD_TASKS_ENC_KEY`. `--hooksDir=docker/pb_hooks` also loads `tasks_encryption.pb.js`, which throws without a 32-character key (`docker/pb_hooks/encryption-core.js:34-38`).
* Decision: PROPOSE FIX
* Reason: Confirmed both hook files. The tip came from `.claude/rules/pocketbase-sync.md`, which has the same gap (see the summary).
* Edit: Added one sentence that names the variable and the 32-character requirement. No key value is written.

### H1-html-5-9 [codebase-details] Severity: Nit
* Target: SYNC line 847
* Finding: Three push paths write fixed sentences to `lastError` without `sanitizeSyncError()`.
* Decision: DECLINE
* Reason: None carries server text, so the safety claim holds.
* Edit: none

### H1-html-5-10 [codebase-details] Severity: Nit
* Target: SYNC line 642
* Finding: "capped" reads as truncation. The fetch throws past the limit.
* Decision: PROPOSE FIX
* Reason: `lib/sync/README.md`: "It throws on ... ".
* Edit: "paged, throws past SYNC_CONFIG.MAX_REMOTE_TASKS".

### H1-html-5-11 [codebase-details] Severity: Nit
* Target: SYNC lines 623-625
* Finding: "After any pull" overstates when `resurrectOnSight` runs.
* Decision: PROPOSE FIX
* Reason: `pb-sync-engine.ts:244-252`.
* Edit: "After both passes, resurrectOnSight brings back a remembered task ...".

### H1-html-5-12 [codebase-details] Severity: Nit
* Target: SYNC lines 621-622
* Finding: A backfill sync is not strictly a one-off.
* Decision: PROPOSE FIX
* Reason: `pb-sync-engine.ts` `isBackfillOwed`, `updateSyncCursor`.
* Edit: "It runs when the stored pull contract version is missing or older than this build's, until a pull completes."

## Side note from the reviewer (code, not the documents)
* `scripts/setup-pocketbase-collections.sh:385` prints "Indexes: ... updated". The reviewer reports that the index the script creates is on `client_updated_at`. Not opened by the driver. Listed in the summary.
