# Doc refresh: D2-adr-late, round 3

Status: resolved
Clean round: yes

One fresh reviewer checked the three status notes edited after round 2 (ADR 0012, 0013, 0015). No Blocker or Major. The NOTE loop stops here.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | status notes in ADR 0012, 0013, 0015 | ran |

## Findings

### D2-adr-late-3-1 [codebase-details] Severity: Nit
* Target: 0015 status note
* Finding: the code's test is "no pending row and at least one failed row" (`classifyRemoteDeletion`, `lib/sync/queue.ts:65-74`). A server-gone task with no queue rows is deleted outright.
* Decision: DECLINE
* Reason: The reviewer notes the two readings coincide in practice. The linked rule file holds the detail.
* Edit: none

### D2-adr-late-3-2 [codebase-details] Severity: Nit
* Target: 0015 status note
* Finding: sign-out also remembers queued Trash deletes (`lib/sync/config/disable.ts:61`). `resurrectOnSight` runs after the whole sync, not only the pull.
* Decision: DECLINE
* Reason: The note links the spec that owns these rules.
* Edit: none

### D2-adr-late-3-3 [codebase-details] Severity: Nit
* Target: 0013 status note
* Finding: `mapOverLocalCopy` also runs for an ordinary live-row update.
* Decision: DECLINE
* Reason: The claim holds for the rule 2 case the note describes.
* Edit: none

### D2-adr-late-3-4 [codebase-details] Severity: Nit
* Target: 0012 status note
* Finding: "`/_` paths" could be read to include `/_next`.
* Decision: DECLINE
* Reason: The ADR body already states `/_next/static/*` is immutable.
* Edit: none
