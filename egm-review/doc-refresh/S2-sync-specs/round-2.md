# Doc refresh: S2-sync-specs, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details (A) | spec-resurrect-on-sight.md | ran |
| egm-codebase-details (B) | spec-conditional-delete.md, spec-notify-before.md | ran |
| egm-codebase-details (C) | spec-cloud-sync-auth-token.md, spec-account-deletion.md, spec-anonymous-feedback.md | ran |
| egm-style (S) | all six files | ran |

Accuracy reviewers A and B raised Nits only. C raised two Majors. S raised 15 Majors, 14 of them on the notes added in round 1.

## Findings

### spec-resurrect-on-sight.md

### S2-sync-specs-2-1 [A] Severity: Nit
* Target: line 157
* Finding: Three of Android's "add" tests are instrumented tests with camelCase names in `ReplaceEraseTest.kt` and `SignedOutDeletesTest.kt`, not in `SyncEngineTest.kt`.
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg` in `gsd-android`. With these, every "add" cell has a test.
* Edit: Section 6 note now says every "add" cell has a test and names the two extra files. Also resolves 2-7.

### S2-sync-specs-2-2 [A] Severity: Nit
* Target: line 95
* Finding: A failed or incomplete listing, or one for another account, also skips the step and leaves the sync successful.
* Decision: PROPOSE FIX
* Reason: Confirmed at `resurrect-on-sight.ts:80-86`.
* Edit: One sentence in the section 4 note.

### S2-sync-specs-2-3 [A] Severity: Nit
* Target: lines 120-124
* Finding: iOS also goes on to the push after a failed step.
* Decision: DECLINE
* Reason: The note lists where iOS differs from section 5. Section 5 doesn't say the run stops.
* Edit: none

### S2-sync-specs-2-4 [S] Severity: Major
* Target: line 124
* Finding: "Stale" is undefined, and the note doesn't say what the difference from section 5 is.
* Decision: PROPOSE FIX
* Reason: The iOS comment on `waitsForThisDevice` says a stale delete counts, one the push drops because the server copy is newer.
* Edit: Rewrote the bullet to say that.

### S2-sync-specs-2-5 [S] Severity: Major
* Target: lines 65, 69, 150, section 8
* Finding: The reader can't tell whether section 8's readings were decided.
* Decision: PROPOSE FIX
* Reason: Web keeps the archive row (`resurrect-on-sight.ts:104-106`) and remembers at sign-out. Android has `isArchived`. I can't see owner item 26.
* Edit: Dated note at the end of section 8, saying what shipped and that the owner item wasn't checked. Header note now names section 8.

### S2-sync-specs-2-6 [S] Severity: Major
* Target: line 100
* Finding: Unclear whether the step or the pull uses `mapOverLocalCopy`.
* Decision: PROPOSE FIX
* Reason: The step calls `pocketBaseToTaskRecord(record, trashed)` (`resurrect-on-sight.ts:110`). The pull calls `mapOverLocalCopy` (`pb-pull.ts:160`).
* Edit: Rewrote the bullet.

### S2-sync-specs-2-7 [S] Severity: Major
* Target: line 157
* Finding: "Most" doesn't say which cells lack a test.
* Decision: PROPOSE FIX
* Reason: See 2-1. None lack one.
* Edit: See 2-1.

### S2-sync-specs-2-8 [S] Severity: Major
* Target: line 96
* Finding: "Forgotten" is applied to a server copy.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: The subject is now the remembered id.

### S2-sync-specs-2-9 [S] Severity: Major
* Target: line 123
* Finding: "The buried row" is a new term.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "the row `tombstones.buriedTask` returns".

### spec-conditional-delete.md

### S2-sync-specs-2-10 [B] Severity: Nit
* Target: line 74
* Finding: `pushSingleItem` does more than dispatch.
* Decision: PROPOSE FIX
* Reason: Confirmed at `pb-push.ts:265-276`.
* Edit: "checks the session, looks up the remote, and dispatches".

### S2-sync-specs-2-11 [B] Severity: Nit
* Target: line 109, "a raw-stamp read"
* Finding: Web already holds the stored text in `remote.clientUpdatedAt`.
* Decision: DECLINE
* Reason: The row is the unbuilt plan. A builder will find this on the first read of `pushDelete`.
* Edit: none

### S2-sync-specs-2-12 [B] Severity: Nit
* Target: line 95
* Finding: `deleteTaskInPB` still exists unused, and the two tools compare differently.
* Decision: DECLINE
* Reason: Detail that belongs to the MCP write-ops README.
* Edit: none

### S2-sync-specs-2-13 [S] Severity: Major
* Target: line 95 vs 144
* Finding: "So the same window exists there" undercuts the exclusion without saying whether it stands.
* Decision: PROPOSE FIX
* Reason: My round 1 note added a conclusion the spec didn't draw.
* Edit: The note now states the fact and that MCP stays out of scope.

### S2-sync-specs-2-14 [S] Severity: Major
* Target: lines 73-74
* Finding: The note doesn't say whether the 400-line constraint holds.
* Decision: PROPOSE FIX
* Reason: A hand count of non-blank, non-comment lines gives 317. The linter was not run.
* Edit: The note gives the hand count and says the constraint holds today.

### S2-sync-specs-2-15 [S] Severity: Major
* Target: line 6
* Finding: "Both scripts" has no referent yet.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "the two schema scripts in section 8".

### spec-notify-before.md

### S2-sync-specs-2-16 [B] Severity: Nit (three)
* Target: line 73 (session exception; "null" vs `undefined`), line 81 (recurring spawns also create)
* Finding: Precision gaps in the round 1 notes.
* Decision: PROPOSE FIX for the two on line 73 and the `createTask` wording. DECLINE the recurring-spawn path.
* Reason: Confirmed at `pb-push.ts:130-137`. The line 81 note now claims only what `createTask` does.
* Edit: Two phrases in the section 6 note, one in the MCP note.

### S2-sync-specs-2-17 [S] Severity: Major
* Target: line 78 beside 81
* Finding: One bullet states the before and the after in the present tense.
* Decision: PROPOSE FIX
* Reason: Valid. The original bullet is the record, so the dated note marks which half is the old state.
* Edit: First sentence of the MCP shipped note.

### S2-sync-specs-2-18 [S] Severity: Major
* Target: lines 69-71
* Finding: "The table's files are right" conflicts with "missing from the table".
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "right, with one file missing".

### spec-cloud-sync-auth-token.md

### S2-sync-specs-2-19 [C] Severity: Nit
* Target: lines 33-35
* Finding: The README also carries the short path in its sample `get_token_status` output.
* Decision: PROPOSE FIX
* Reason: Confirmed at `packages/mcp-server/README.md:538`.
* Edit: "The setup steps in the MCP README and quick-start".

### S2-sync-specs-2-20 [S] Severity: Major
* Target: lines 30-33
* Finding: Unclear which label changed and whether the description sentence was replaced.
* Decision: PROPOSE FIX
* Reason: `sync-auth-token-row.tsx:49-59`: row label "MCP access", button "Copy auth token", description with three sentences.
* Edit: Rewrote the two sentences.

### spec-account-deletion.md

### S2-sync-specs-2-21 [C] Severity: Major
* Target: line 75
* Finding: The toast differs when tasks were already erased, and a token refused at step 1 is forgotten by `forgetRefusedToken`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `delete-account-dialog.tsx:79-89`, `pb-auth.ts` `refreshAuthOutcome`, `pocketbase-client.ts:63-65`. My round 1 sentence was too broad.
* Edit: Rewrote the sentence. This also narrows the possible defect from round 1 (see the final summary).

### S2-sync-specs-2-22 [C] Severity: Nit (three)
* Target: line 61 (third listing), line 59 (404 can have another cause), line 82 (`syncEnabled` is not "signed in")
* Finding: Precision gaps in the round 1 notes.
* Decision: PROPOSE FIX for lines 61 and 82. DECLINE line 59.
* Reason: Confirmed at `pb-account-deletion.ts:190-205` and `settings-body.tsx:161`. The 404 case falls back either way.
* Edit: Two phrases.

### S2-sync-specs-2-23 [S] Severity: Major
* Target: line 5
* Finding: "A dated note in each section" is not true.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Line 5 names the sections with notes and says the rest describe the fallback as first approved.

### S2-sync-specs-2-24 [S] Severity: Major
* Target: line 60
* Finding: The production path is reported second-hand.
* Decision: PROPOSE FIX
* Reason: Code can't show what the hosted server loads.
* Edit: The note says it didn't check the server.

### S2-sync-specs-2-25 [S] Severity: Major
* Target: line 146
* Finding: The note doesn't say whether the seven stubbed behaviors still have tests.
* Decision: PROPOSE FIX
* Reason: Read the test list. Six of the seven have a test in the 404-fallback block. A 401 or 403 is tested on the route (`:99`) and on a task delete (`:235`), not on the fallback's `users.delete`.
* Edit: Rewrote the note.

### spec-anonymous-feedback.md

### S2-sync-specs-2-26 [C] Severity: Major
* Target: lines 72-73
* Finding: "The only surfaces" omits a footer link and a help-drawer link.
* Decision: PROPOSE FIX
* Reason: Confirmed at `components/app-footer.tsx:31-34` and `help-drawer-sections.tsx:279`.
* Edit: Dated parenthetical. The original sentence is kept.

### S2-sync-specs-2-27 [C] Severity: Nit (four)
* Target: lines 87-88 (5xx text), 45 (hook rejects a non-empty `status`), 29 (host), 184-186 (rule citation)
* Finding: Precision gaps.
* Decision: PROPOSE FIX for 87-88, 45, and 184-186. DECLINE line 29, as in round 1.
* Reason: Confirmed at `use-feedback-form.ts:21-26`, `feedback_controls.pb.js:10`, `.claude/rules/testing.md:37`.
* Edit: Three phrases.

### S2-sync-specs-2-28 [S] Severity: Major
* Target: lines 166-169
* Finding: "Most stubs" and "no test is named for keyboard reach" can't be resolved.
* Decision: PROPOSE FIX
* Reason: `rg` for keyboard, Tab, Enter, and Space in the UI and e2e files finds nothing. I did not map every other stub to a test, so the note no longer says "most".
* Edit: Rewrote the note.
