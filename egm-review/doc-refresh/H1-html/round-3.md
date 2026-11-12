# Doc refresh: H1-html, round 3

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | docs/architecture.html | ran, 0 Blocker, 1 Major, 5 Nit |
| egm-codebase-details | docs/cloud-sync-explainer.html | ran, 0 Blocker, 0 Major, 5 Nit |

Style reviewers run in rounds 1 and 2 only. ARCH is `docs/architecture.html`, SYNC is `docs/cloud-sync-explainer.html`.

## Findings: docs/architecture.html

### H1-html-3-1 [codebase-details] Severity: Major
* Target: ARCH line 414 (and 412)
* Finding: "`deviceInfo` | Device identity row". The only write is the schema v7 migration (`lib/db-migrations.ts:85`). Sync reads the device id from `sync_config` in `syncMetadata` (`lib/sync/pb-sync-helpers.ts:52-56`).
* Decision: PROPOSE FIX
* Reason: Confirmed `getDeviceId`. A search of `lib/`, `components/`, and `app/` found `deviceInfo` only in `lib/db.ts` and `lib/db-migrations.ts`.
* Edit: `deviceInfo` cell: "Legacy row from the schema v7 migration. Sync reads the device id from syncMetadata". `syncMetadata` cell: "Sync config (cursor, device id) and device-local sync records".

### H1-html-3-2 [codebase-details] Severity: Nit
* Target: ARCH lines 336-344
* Finding: The sync path flow skips `pb-sync-engine.ts` and shows one order.
* Decision: DECLINE
* Reason: Fixing it needs a new flow step, which changes the diagram. The ordinary order is correct.
* Edit: none

### H1-html-3-3 [codebase-details] Severity: Nit
* Target: ARCH line 443
* Finding: The LWW paragraph simplifies the far-future rules.
* Decision: DECLINE
* Reason: `lib/sync/README.md` owns that detail.
* Edit: none

### H1-html-3-4 [codebase-details] Severity: Nit
* Target: ARCH line 265
* Finding: `/sweep` also has no rail item.
* Decision: PROPOSE FIX
* Reason: `icon-rail.tsx:33-37`.
* Edit: Added the weekly sweep to the sentence.

### H1-html-3-5 [codebase-details] Severity: Nit
* Target: ARCH line 247
* Finding: Ctrl+K also opens the palette (`lib/use-command-palette.ts:112`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added "(or Ctrl+K)".

### H1-html-3-6 [codebase-details] Severity: Nit
* Target: ARCH line 466
* Finding: Merge-mode import does more than regenerate ids.
* Decision: DECLINE
* Reason: The cell is a summary.
* Edit: none

## Findings: docs/cloud-sync-explainer.html

### H1-html-3-7 [codebase-details] Severity: Nit
* Target: SYNC lines 875, 891
* Finding: "the coordinator owns scheduling and backoff". Scheduling is in `BackgroundSyncManager`, backoff in the retry manager.
* Decision: PROPOSE FIX
* Reason: `background-sync.ts`, `sync-coordinator.ts:121-131`.
* Edit: Both summary lines reworded.

### H1-html-3-8 [codebase-details] Severity: Nit
* Target: SYNC lines 839-840
* Finding: A realtime delete event is a third path (`pb-sync-engine.ts` `applyRemoteDeletion`).
* Decision: PROPOSE FIX
* Reason: `lib/sync/README.md` says it shares `classifyRemoteDeletion`.
* Edit: Title is now "How deletes travel". One sentence added for the realtime event.

### H1-html-3-9 [codebase-details] Severity: Nit
* Target: SYNC line 840
* Finding: The Trash condition is no pending row and at least one failed row (`queue.ts:65-74`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Sentence states that condition.

### H1-html-3-10 [codebase-details] Severity: Nit
* Target: SYNC line 658
* Finding: Wire names also appear outside the mapper.
* Decision: DECLINE
* Reason: Same as H1-html-2-19.
* Edit: none

### H1-html-3-11 [codebase-details] Severity: Nit
* Target: SYNC lines 527-528
* Finding: `state` is not an argument to `authWithOAuth2Code` (`pb-auth.ts:191,201-203`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Comment now reads "wait for the relayed code for this tab's state, then authWithOAuth2Code with the PKCE verifier".
