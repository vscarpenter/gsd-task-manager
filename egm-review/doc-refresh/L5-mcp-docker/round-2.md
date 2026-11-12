# Doc refresh: L5-mcp-docker, round 2

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| accuracy A1 (egm-codebase-details) | packages/mcp-server/README.md lines 1-600 | ran |
| accuracy A2 (egm-codebase-details) | packages/mcp-server/README.md lines 600-947 | ran |
| accuracy A3 (egm-codebase-details) | docker/README.md, docs/diagrams/reminder-model/README.md, docs/diagrams/task-lifecycle-model/README.md | ran |
| accuracy A4 (egm-codebase-details) | packages/mcp-server/QUICKSTART.md, packages/mcp-server/QUICK_TEST.md, packages/mcp-server/TESTING.md, packages/mcp-server/TEST_PLAN.md | ran |
| style S1 (egm-style) | packages/mcp-server/README.md lines 1-955 | ran, after the accuracy fixes to that file |
| style S2 (egm-style) | the other seven files | ran |

## Findings

### L5-mcp-docker-2-1 [accuracy A1] Severity: Major
* Target: packages/mcp-server/README.md lines 332-355
* Finding: list_tasks example omits fields every task carries (`src/types.ts:126-154`).
* Decision: PROPOSE FIX
* Reason: Confirmed by the round 1 reviewer too. A full field list would drift.
* Edit: Added two sentences that say the example is abridged and point to src/types.ts.

### L5-mcp-docker-2-2 [accuracy A1] Severity: Major
* Target: packages/mcp-server/README.md line 36
* Finding: "Proactive warnings": nothing warns unprompted (`read-handlers.ts:46` is the only caller).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Rewrote the bullet.

### L5-mcp-docker-2-3 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 541-543
* Finding: Thresholds use whole days rounded down (`token-status.ts:86`).
* Decision: PROPOSE FIX
* Reason: Cheap and exact.
* Edit: Added to the Status Levels line.

### L5-mcp-docker-2-4 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 564-566
* Finding: get_cache_stats example sizes.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-5 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 37, 264
* Finding: A filtered list with no cached list is not cached (`list-tasks.ts:33-51`).
* Decision: PROPOSE FIX
* Reason: Sentence was mine from round 1.
* Edit: "Reads" is now "Most reads".

### L5-mcp-docker-2-6 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 206, 454-463
* Finding: Due this week is a rolling window.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-7 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 369, 377
* Finding: Two input limits not stated.
* Decision: DECLINE
* Reason: Omissions.
* Edit: none

### L5-mcp-docker-2-8 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 596-597
* Finding: Not every failed write returns a one-word code (`handlers/index.ts:135-138`, `recurrence.ts:60-67`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The sentence was mine from round 1.
* Edit: Narrowed the sentence; added a paragraph on the recurring write.

### L5-mcp-docker-2-9 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md lines 803-805
* Finding: `not_found` advice points at the wrong cause. A wrong URL gives "Cannot reach PocketBase" (`pocketbase-client.ts:120-128`, `helpers.ts:105-109`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The entry was mine from round 1.
* Edit: Rewrote the `not_found` bullet.

### L5-mcp-docker-2-10 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md lines 587-597
* Finding: Pacing and error-code rules have exceptions for the next recurring instance (`bulk-operations.ts:132-150`, `recurrence.ts:54-68`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The section was mine from round 1.
* Edit: Added a paragraph; "write once" now reads "send each write once".

### L5-mcp-docker-2-11 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 592-594
* Finding: Stale dependency needs a read during cleanup (`list-tasks.ts:57-59`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Sharpens the issue #729 statement.
* Edit: Reworded.

### L5-mcp-docker-2-12 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 588
* Finding: Retry covers the preflight read too.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-2-13 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 777
* Finding: Config error is two log lines.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-14 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 797-798
* Finding: Bulk Saved refusal text differs.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-15 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 803-808
* Finding: Three codes not listed.
* Decision: DECLINE
* Reason: The entry links the file that owns the map.
* Edit: none

### L5-mcp-docker-2-16 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 737
* Finding: bulk_update_tasks returns formatted text (`write-handlers.ts:175-207`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Reworded Returns.

### L5-mcp-docker-2-17 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 734
* Finding: Bulk delete also cleans dependencies.
* Decision: DECLINE
* Reason: Omission.
* Edit: none

### L5-mcp-docker-2-18 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 692-694
* Finding: Two delete_task outcomes omitted.
* Decision: DECLINE
* Reason: Omission.
* Edit: none

### L5-mcp-docker-2-19 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 649
* Finding: update_task does not show the new instance.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-2-20 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 617
* Finding: URL extraction rules omitted.
* Decision: DECLINE
* Reason: Omission.
* Edit: none

### L5-mcp-docker-2-21 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 646
* Finding: Subtask id length.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-22 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 842-844
* Finding: Version scripts exist only in the package.
* Decision: PROPOSE FIX
* Reason: Confirmed in package.json.
* Edit: Comment names the directory.

### L5-mcp-docker-2-23 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 851-853
* Finding: Workflow order differs.
* Decision: PROPOSE FIX
* Reason: Confirmed in the workflow.
* Edit: Reordered the sentence. Manual dispatch not added.

### L5-mcp-docker-2-24 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 857-911
* Finding: Tree is accurate but incomplete.
* Decision: DECLINE
* Reason: Tests, READMEs, and config files are left out on purpose.
* Edit: none

### L5-mcp-docker-2-25 [accuracy A3] Severity: Major
* Target: docker/README.md lines 1-271
* Finding: npm registry build secret has no instructions; docker-compose.yml says "see README.md".
* Decision: PROPOSE FIX
* Reason: The contract section names the secret but gives no steps. Steps come from the compose file's own comments.
* Edit: Added a short "Private npm Registry" section.

### L5-mcp-docker-2-26 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 57-58
* Finding: The port line exists commented out.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: "add" is now "uncomment".

### L5-mcp-docker-2-27 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 67-68
* Finding: Script also needs mktemp.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added.

### L5-mcp-docker-2-28 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 182-185
* Finding: "new volume" is narrower than the code; one overlay file is identical to its namesake.
* Decision: PROPOSE FIX
* Reason: Confirmed in docker/lib/migrations.sh.
* Edit: Reworded, then rewritten for finding 51.

### L5-mcp-docker-2-29 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 215-244
* Finding: Table omits created and updated.
* Decision: DECLINE
* Reason: System fields; the table says it may lag.
* Edit: none

### L5-mcp-docker-2-30 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 3
* Finding: Not every action has a comment.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-31 [accuracy A3] Severity: Nit
* Target: docs/diagrams/task-lifecycle-model/README.md line 48
* Finding: Cache path is a default.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-32 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md lines 102-111
* Finding: LOG_LEVEL=debug shows nothing: no shipped code calls logger.debug.
* Decision: PROPOSE FIX
* Reason: Confirmed by search. The line was my round 1 fix, so this reverts it.
* Edit: Removed the LOG_LEVEL line; the heading text now says "watch the server's log".

### L5-mcp-docker-2-33 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 148-152
* Finding: Same: the verbose logging section produces no output.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Section now says there is no verbose mode and where to add a debug call.

### L5-mcp-docker-2-34 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 240-256
* Finding: The version is also written by hand in other files.
* Decision: PROPOSE FIX
* Reason: Confirmed in public/index.md, server-card.json, and mcp-section.tsx.
* Edit: Added a paragraph here and in the README's publishing text.

### L5-mcp-docker-2-35 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md lines 7-11
* Finding: npm install in a Bun workspace.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-36 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md line 19
* Finding: Token row details.
* Decision: DECLINE
* Reason: Declined in round 1.
* Edit: none

### L5-mcp-docker-2-37 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 5-16
* Finding: Start deletes the setup artifact; no build step.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-2-38 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md line 186
* Finding: Node >= 18.
* Decision: DECLINE
* Reason: Matches engines.
* Edit: none

### L5-mcp-docker-2-39 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TEST_PLAN.md lines 254-255
* Finding: Workflow gates not listed.
* Decision: DECLINE
* Reason: The plan's steps satisfy both gates.
* Edit: none

### L5-mcp-docker-2-40 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 501, 591
* Finding: "the server" means PocketBase in two places.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Both now say PocketBase.

### L5-mcp-docker-2-41 [style S1] Severity: Major
* Target: packages/mcp-server/README.md line 280
* Finding: "the sign-in error" has no referent.
* Decision: PROPOSE FIX
* Reason: Valid. Sentence was mine.
* Edit: Quotes the message and links Troubleshooting.

### L5-mcp-docker-2-42 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 603, 812, 816
* Finding: Error codes contradict their definition (network_error is no HTTP status).
* Decision: PROPOSE FIX
* Reason: Status 0 maps to network_error (`write-rate-limiter.ts:13`).
* Edit: Both sentences reworded.

### L5-mcp-docker-2-43 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 37, 571, 599
* Finding: Cache invalidation stated three ways.
* Decision: PROPOSE FIX
* Reason: Line 571 is the tool's literal text (`system-handlers.ts:281`).
* Edit: Added a note under the sample.

### L5-mcp-docker-2-44 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 382-383
* Finding: picks count contradicts needsTidy.
* Decision: PROPOSE FIX
* Reason: `todaysPicks` slices to three and flags overflow (`top-three.ts:121-129`).
* Edit: Reworded.

### L5-mcp-docker-2-45 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 276, 805
* Finding: "the matrix" is never defined.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Defined at first use.

### L5-mcp-docker-2-46 [style S1] Severity: Major
* Target: packages/mcp-server/README.md line 737
* Finding: Tag note reads as a caller requirement; remove_tags has none.
* Decision: PROPOSE FIX
* Reason: Both use nonEmptyTagsSchema (`input-schemas.ts:139-140`).
* Edit: Both notes reworded.

### L5-mcp-docker-2-47 [style S1] Severity: Major
* Target: packages/mcp-server/README.md line 793
* Finding: Unclear pronoun.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Reworded.

### L5-mcp-docker-2-48 [style S2] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 23-26
* Finding: "Press Ctrl+C" follows the --validate sentence.
* Decision: PROPOSE FIX
* Reason: My round 1 insert was in the wrong place.
* Edit: Moved the sentence.

### L5-mcp-docker-2-49 [style S2] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 6, 226
* Finding: Relation between the two suites is not stated.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Line 6 says when to run each; the total says 5 quick, 25 full.

### L5-mcp-docker-2-50 [style S2] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 99-221
* Finding: Most tests have no pass condition.
* Decision: ESCALATE
* Reason: What counts as a pass is the owner's test design.
* Edit: none

### L5-mcp-docker-2-51 [style S2] Severity: Major
* Target: docker/README.md lines 49-51, 187-193, 218
* Finding: Migration story on a new install cannot be followed.
* Decision: PROPOSE FIX
* Reason: Rewrote from migrations.sh, the entrypoint, and the migration files (each tasks migration returns early when the table is missing).
* Edit: Rewrote the paragraph and the schema lead-in.

### L5-mcp-docker-2-52 [style S2] Severity: Major
* Target: docker/README.md lines 44-45
* Finding: docker run path: a port cannot be removed by a restart.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Added three sentences.

### L5-mcp-docker-2-53 [style S2] Severity: Major
* Target: docker/README.md line 248
* Finding: focus_rank 0 to 3 for three picks.
* Decision: PROPOSE FIX
* Reason: Valid ranks are 1 to 3; 0 is sent when there is no pick (`lib/top-three.ts:223`).
* Edit: Reworded the row.

### L5-mcp-docker-2-54 [style S2] Severity: Major
* Target: docs/diagrams/reminder-model/README.md lines 30-32
* Finding: "the chart" has no stable referent.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Paragraph reworded.

### L5-mcp-docker-2-55 [style S2] Severity: Major
* Target: docs/diagrams/reminder-model/README.md line 32
* Finding: The stale 41: defect or accepted?
* Decision: ESCALATE
* Reason: The generator is outside this batch. 76 comes from this README and `.claude/skills/verify-reminders/SKILL.md:36`; TLC was not run.
* Edit: none

### L5-mcp-docker-2-56 [style S2] Severity: Major
* Target: docs/diagrams/task-lifecycle-model/README.md line 52
* Finding: First sentence of "What the chart hides" cannot be parsed.
* Decision: PROPOSE FIX
* Reason: Rewrote from the comment and `undoDelete` in view.mjs:61-68.
* Edit: Rewrote.

### L5-mcp-docker-2-57 [style S2] Severity: Major
* Target: docs/diagrams/task-lifecycle-model/README.md lines 25, 50-56
* Finding: One chart has several names.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "board chart" and "the chart" now say "recurring chart".

## Notes

* All reviewers were new this round.
* Several Majors sat on text added in round 1. None called for reverting a fix except the LOG_LEVEL line (findings 32 and 33), which is reverted.
