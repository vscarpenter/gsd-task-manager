# Doc refresh: S3-product-specs, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | tasks/spec-top-three.md | ran |
| egm-codebase-details | tasks/spec-weekly-sweep.md | ran |
| egm-codebase-details | tasks/spec-escalation.md, tasks/spec-whats-new.md (full), and the status notes of the four finished documents | ran |
| egm-style | all eight files (status notes only for the four finished documents) | ran |

Each reviewer got the list of items escalated in round 1, marked as settled.

## Findings

### S3-2-1 [accuracy] Severity: Major
* Target: spec-top-three.md line 5 (also 236, 353)
* Finding: My round 1 note said the MCP server "shipped" top three. `packages/mcp-server/CHANGELOG.md:8-21` lists `get_top_three` and the mapping under Unreleased, and the package is at 1.4.1.
* Decision: PROPOSE FIX
* Reason: Confirmed in the changelog and `package.json`.
* Edit: The status line now says the MCP server has it on `main`, unreleased. The section 8 bullet reads "Merged".

### S3-2-2 [accuracy] Severity: Nit
* Target: spec-top-three.md line 333
* Finding: Section 11's Server line still names `docker/pb_migration_drafts/` with no dated mark.
* Decision: PROPOSE FIX
* Reason: Confirmed in round 1 that the folder is gone.
* Edit: Added "(done, see section 10)".

### S3-2-3 [accuracy] Severity: Nit
* Target: spec-top-three.md lines 107, 112, 192-213, 238-239, 344, 360
* Finding: Five small gaps: the pick line shows whenever a slot is free; the strip has its own `DndContext`; one named test is parameterized; `get_top_three` returns full task objects; MCP runs 54 of the 123 cases.
* Decision: DECLINE
* Reason: None contradicts the spec. Two overlap items escalated in round 1.
* Edit: none

### S3-2-4 [accuracy] Severity: Nit
* Target: spec-weekly-sweep.md lines 65, 91, 134, 149, 171, 200
* Finding: Five nits: the sweep keeps its own copy of the Mark urgent hint; the entry is a link in the Today strip header; the end links stamp a second time; a denied permission still saves the setting as on; `/sweep/` is not next to `/saved/` in the list.
* Decision: DECLINE
* Reason: Small. The second stamp and the denied-permission state go under possible code defects.
* Edit: none

### S3-2-5 [accuracy] Severity: Nit
* Target: spec-escalation.md line 4
* Finding: My note's "so sections 7 and 8 describe finished web work" does not follow. Section 8 steps 2 to 4 are native work.
* Decision: PROPOSE FIX
* Reason: Valid. I confirmed the section 7 test files exist.
* Edit: Reworded to "On web, the tests in section 7 exist and rollout step 1 is done."

### S3-2-6 [accuracy] Severity: Nit
* Target: spec-whats-new.md line 55
* Finding: My corpus note said the corpus rejects a build suffix. The corpus has a prerelease case only (`whats-new-corpus.json:273`); `parseVersion` rejects a build suffix.
* Decision: PROPOSE FIX
* Reason: Confirmed in the corpus.
* Edit: Note now separates what the corpus pins from what `parseVersion` adds.

### S3-2-7 [accuracy] Severity: Nit
* Target: spec-escalation.md line 79; spec-whats-new.md lines 39, 72
* Finding: The corpus tests pass partial tasks; a null running version lists every release; "existing user" excludes a device holding only Saved items.
* Decision: DECLINE
* Reason: First two were declined in round 1. The third is consistent with the wording.
* Edit: none

### S3-2-8 [accuracy] Severity: Nit
* Target: spec-ios27-refresh.md line 3
* Finding: The gesture is in `SwipeActionRow`, and the trailing swipe still snoozes one hour.
* Decision: PROPOSE FIX
* Reason: Confirmed in `swipeable-task-card.tsx:8, 30, 39`.
* Edit: Both facts added to the status note.

### S3-2-9 [style] Severity: Major
* Target: spec-top-three.md lines 144-149
* Finding: The section 6 note said "the three placement keys", "owed", "has no session", and "the unread fields", none of which the requirements use. It named `runSyncPasses` with no link to `fullSync`.
* Decision: PROPOSE FIX
* Reason: Valid. Confirmed `fullSync` calls `runSyncPasses` (`pb-sync-engine.ts:244`) and that the repair copies the focus pair and `savedAt`.
* Edit: Note now uses the spec's terms and names the three keys.

### S3-2-10 [style] Severity: Major
* Target: spec-top-three.md line 144
* Finding: "#703 made every web change" overclaims. The spec assigns the Saved half to WEB-SAVED, and the hold-off had no bullet.
* Decision: PROPOSE FIX
* Reason: Valid. `git log` shows other commits touched the same files.
* Edit: The note now lists the requirements it covers, credits #703 with the contract 4 half only, and says it does not cover the hold-off (escalated as S3-1-9).

### S3-2-11 [style] Severity: Major
* Target: spec-top-three.md lines 5, 223-230, 236-239
* Finding: The status line did not say whether envelope 2.2.0, the fixture, the MCP mapping, and the spawn rule shipped. "Sprint 2 bumps no app version" sits beside "the web release is 14.8.0".
* Decision: PROPOSE FIX
* Reason: Confirmed: `import-export.ts:25`, the fixture and its two tests, `types.ts:185, 227`, `write-ops/recurrence.ts:38-39`, and #712.
* Edit: Added a dated bullet in section 7 and two sentences to the section 8 bullet.

### S3-2-12 [style] Severity: Major
* Target: spec-top-three.md line 296
* Finding: "Both schema scripts" and "the rest of this section and step 3 below" were ambiguous.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Named both scripts, and pointed at "the next paragraph" and "step 3 of the hosted list".

### S3-2-13 [style] Severity: Major
* Target: spec-weekly-sweep.md lines 5, 109
* Finding: The status line did not say the vote count is still unrecorded. The third-key note did not say it also bears on sections 2, 10, and 12.
* Decision: PROPOSE FIX
* Reason: Valid. Section 8 still shows the count as pending.
* Edit: One sentence added to each note.

### S3-2-14 [style] Severity: Major
* Target: spec-escalation.md lines 4, 83; spec-whats-new.md line 4
* Finding: The notes did not say what the Apple and Android release notes prove. "It uses the 2-day default window" read as the corpus test.
* Decision: PROPOSE FIX
* Reason: Valid. Confirmed the Apple 3.8.0 and Android 0.11.0 notes announce a What's New screen (`whats-new.json:292, 379`).
* Edit: Both notes now say the release notes are the only evidence here for the native clients. The subject is now `get_top_three`.

### S3-2-15 [style] Severity: Major
* Target: spec-escalation.md line 110; spec-whats-new.md lines 61-64
* Finding: The open question "or wait for top three?" stands though top three arrived. Rule step 5 gives no outcome when a notable release exists; the reader must infer it falls through to step 8.
* Decision: ESCALATE
* Reason: An owner question and cross-client rule wording. `decideWhatsNew` (`lib/whats-new/decide.ts:51-66`) does fall through to show, but the web code alone can't reword a contract.
* Edit: none

### S3-2-16 [style] Severity: Major
* Target: spec-ios27-refresh.md line 3
* Finding: The note did not say which prop changed.
* Decision: PROPOSE FIX
* Reason: Confirmed in `topbar.tsx:20` and `app-shell.tsx:48, 131`.
* Edit: Note names `SimplifiedTopbar` and says `AppShell` keeps `quietChromeOnScroll`.
