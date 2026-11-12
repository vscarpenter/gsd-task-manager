# Doc refresh: H1-html, round 4

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | docs/architecture.html | ran, 0 Blocker, 0 Major, 3 Nit |
| egm-codebase-details | docs/cloud-sync-explainer.html | ran, 0 Blocker, 1 Major, 4 Nit |

ARCH is `docs/architecture.html`, SYNC is `docs/cloud-sync-explainer.html`. ARCH on its own was clean this round.

## Findings: docs/architecture.html

### H1-html-4-1 [codebase-details] Severity: Nit
* Target: ARCH line 247
* Finding: "Mounted in AppShell on every route" while the OAuth callback page has no shell.
* Decision: DECLINE
* Reason: Line 252 states the exception.
* Edit: none

### H1-html-4-2 [codebase-details] Severity: Nit
* Target: ARCH line 462
* Finding: The export card names `taskRecordSchema.strict()` only. Archive, Trash, and smart view rows use their own schemas.
* Decision: DECLINE
* Reason: True for live tasks, and the card is a summary.
* Edit: none

### H1-html-4-3 [codebase-details] Severity: Nit
* Target: ARCH line 235
* Finding: The quadrant button shows only once the field holds text.
* Decision: DECLINE
* Reason: Too fine for this card.
* Edit: none

## Findings: docs/cloud-sync-explainer.html

### H1-html-4-4 [codebase-details] Severity: Major
* Target: SYNC lines 386, 589, 648, 715, 819, 876, 895
* Finding: "A strictly newer remote wins" is given as the whole rule. The 5-minute clock-skew ceiling is missing (`lib/constants/sync.ts:54`, `task-mapper.ts:30-35`, `pb-push.ts:364-370`, `pb-sync-helpers.ts:293-297`). The reviewer called the severity borderline.
* Decision: PROPOSE FIX
* Reason: Confirmed `isRemoteNewer` and `holdsOffFarFutureRemote`. Round 1 escalated this as part of H1-html-1-73. One sentence in the LWW gotcha covers it without a new section.
* Edit: The LWW gotcha now states the ceiling and its three effects. The push sample comment adds "(a far-future stamp never counts)".

### H1-html-4-5 [codebase-details] Severity: Nit
* Target: SYNC line 571
* Finding: "Every task mutation" overstates it. Reminder writes in `lib/notification-checker.ts` enqueue nothing.
* Decision: PROPOSE FIX
* Reason: Confirmed by the reviewer's citations and the device-local field rule.
* Edit: "A task edit writes to Dexie and ...".

### H1-html-4-6 [codebase-details] Severity: Nit
* Target: SYNC lines 603-604
* Finding: A failed row is deleted when its task leaves by a remote deletion.
* Decision: DECLINE
* Reason: The delete gotcha covers that path.
* Edit: none

### H1-html-4-7 [codebase-details] Severity: Nit
* Target: SYNC lines 825-826
* Finding: "not synced through" can read as "not sent". The fields are sent on push and ignored on read.
* Decision: DECLINE
* Reason: The body states the read-side rule. The title predates this refresh.
* Edit: none

### H1-html-4-8 [codebase-details] Severity: Nit
* Target: SYNC lines 348, 451
* Finding: `api.vinny.io` applies to the hosted app only.
* Decision: DECLINE
* Reason: Same as H1-html-1-80.
* Edit: none

## Side note from the reviewer (code, not the documents)
* `lib/sync/pocketbase-client.ts:5-6` says the SDK "handles token refresh internally". `pb-auth.ts` `ensureValidAuth` does the refresh. Listed in the summary under possible code defects as a stale comment.
