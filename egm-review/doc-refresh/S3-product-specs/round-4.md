# Doc refresh: S3-product-specs, round 4

Status: resolved
Clean round: no

A second driver ran this round on 2026-11-12, after the first was cut off. It read rounds 1 to 3 and gave each reviewer their CONTEST, ESCALATE, and DECLINE items as settled.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/spec-top-three.md (full) | ran |
| egm-codebase-details | tasks/spec-weekly-sweep.md, tasks/spec-escalation.md, tasks/spec-whats-new.md (full), and the status notes of the four finished documents | ran |

No style reviewer: this continuation runs accuracy reviewers only. The reviewer found the four status notes match the code.

## Findings

### S3-4-1 [accuracy] Severity: Nit
* Target: spec-top-three.md line 3
* Finding: The status line still says "Not implemented on any client", and only line 5 corrects it.
* Decision: DECLINE
* Reason: The status line is the dated record. The correction sits two lines below it, by the batch rule for specs.
* Edit: none

### S3-4-2 [accuracy] Severity: Nit
* Target: spec-top-three.md lines 167, 176
* Finding: C4-3 and C4-4 mention web's literal `pullCursorVersion: 2` at `use-sync-auth-dialog.ts:214`. The literal is gone (`components/sync/use-sync-auth-dialog.ts:221`), and the section 6 note covers only "the web bullets below".
* Decision: PROPOSE FIX
* Reason: Confirmed at line 221: `pullCursorVersion: existingConfig?.pullCursorVersion`.
* Edit: One sentence added to the C4-1 line of the section 6 note. It says the C4-3 and C4-4 mentions describe earlier builds.

### S3-4-3 [accuracy] Severity: Nit
* Target: spec-top-three.md line 170
* Finding: C4-4 copies the pair "if the local pair is unset, the remote's is set". `unreadFieldsToCopy` tests `focusDate` only (`lib/top-three.ts:263`), and `unreadFieldRepair` detects a change through `focusDate` and `savedAt` only (`lib/sync/pb-pull.ts:99`).
* Decision: DECLINE
* Reason: `updateTask` keeps the pair together, so a lone field is not a normal state. C4-4 is contract text, and the web code alone can't reword it.
* Edit: none

### S3-4-4 [accuracy] Severity: Nit
* Target: spec-top-three.md line 226
* Finding: "Web's export is `.strict()`, so it fails loudly without them." The export skips a task that fails the schema and returns a count (`collectExportableTasks`, `lib/tasks/import-export.ts:49-71`).
* Decision: PROPOSE FIX
* Reason: Confirmed: `safeParse` failure increments `skippedCount` and logs a warning. Nothing throws.
* Edit: The sentence now says the export skips each picked task and counts it as unreadable.

### S3-4-5 [accuracy] Severity: Major
* Target: spec-escalation.md lines 41, 46-47
* Finding: "Notes that the corpus pins" lists dependencies, tags, subtasks, and "Archived and Trash rows are never evaluated". `tests/fixtures/cross-platform/escalation-corpus.json` has cases for recurrence and snooze only (lines 424, 444), and no `location` field.
* Decision: ESCALATE
* Reason: Confirmed by search of the corpus. This is a contract statement about a shared corpus, as S3-1-29 was for the sweep. The fix may be new cases in three repos.
* Edit: none

### S3-4-6 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md line 109
* Finding: The dated note lists sections 2, 10, and 12 as holding the "two values" wording. Section 6 holds it too (lines 95 and 107).
* Decision: PROPOSE FIX
* Reason: Confirmed by reading section 6.
* Edit: The note now says "this section and sections 2, 10, and 12".

### S3-4-7 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md line 171
* Finding: `/sweep/` sits after `/settings/` in `public/sw.js:25-28`, not beside `/saved/`.
* Decision: DECLINE
* Reason: Declined in round 2 as part of S3-2-4. The entry exists.
* Edit: none

### S3-4-8 [accuracy] Severity: Nit
* Target: spec-whats-new.md line 21
* Finding: The web cue also shows a "New in {version}:" prefix before the headline (`components/matrix-simplified/whats-new-cue.tsx:96`).
* Decision: DECLINE
* Reason: An addition, not a contradiction. The line is cross-client surface text.
* Edit: none
