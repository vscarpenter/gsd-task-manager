# Doc refresh: L5-mcp-docker, round 1

Status: resolved
Clean round: no

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| accuracy A1 (egm-codebase-details) | packages/mcp-server/README.md lines 1-559 | ran |
| accuracy A2 (egm-codebase-details) | packages/mcp-server/README.md lines 560-887 | ran |
| accuracy A3 (egm-codebase-details) | docker/README.md, docs/diagrams/reminder-model/README.md, docs/diagrams/task-lifecycle-model/README.md | ran |
| accuracy A4 (egm-codebase-details) | packages/mcp-server/QUICKSTART.md, packages/mcp-server/QUICK_TEST.md, packages/mcp-server/TESTING.md, packages/mcp-server/TEST_PLAN.md | ran |
| style S1 (egm-style) | packages/mcp-server/README.md lines 1-887 | ran |
| style S2 (egm-style) | the other seven files | ran |

## Findings

### L5-mcp-docker-1-1 [accuracy A1] Severity: Major
* Target: packages/mcp-server/README.md lines 29-75, 272-557
* Finding: `get_top_three` is not documented. The server advertises it (`src/tools/schemas/read-tools.ts:106-131`).
* Decision: PROPOSE FIX
* Reason: Confirmed in read-tools.ts and top-three-handler.ts.
* Edit: Added a `get_top_three` section and a Features bullet.

### L5-mcp-docker-1-2 [accuracy A1] Severity: Major
* Target: packages/mcp-server/README.md line 32
* Finding: "Writes are paced and retried once after a 429" holds only for delete_task and bulk_update_tasks (`task-operations.ts:427`, `bulk-operations.ts:358`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Issue #730 may change the code; the text states today's behavior.
* Edit: Rewrote the Features bullet; added "Pacing and the cache".

### L5-mcp-docker-1-3 [accuracy A1] Severity: Major
* Target: packages/mcp-server/README.md line 446
* Finding: `get_task_insights` returns no recommendations (`src/analytics/aggregator.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed in aggregator.ts.
* Edit: Listed what the summary holds.

### L5-mcp-docker-1-4 [accuracy A1] Severity: Major
* Target: packages/mcp-server/README.md lines 10-18, 120, 264-268
* Finding: README pins 1.4.1 but describes behavior CHANGELOG.md lists under [Unreleased].
* Decision: ESCALATE
* Reason: The README matches the source and package.json is 1.4.1. Which text ships with which release is the owner's call.
* Edit: none

### L5-mcp-docker-1-5 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md line 320
* Finding: Tag filter is normalized, so `#work` also matches (`input-schemas.ts:36-46`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Rewrote the parameter note.

### L5-mcp-docker-1-6 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 384-386, 431-440
* Finding: Due-this-week is a rolling 7-day window that includes today.
* Decision: DECLINE
* Reason: Detail belongs to the code; no claim in the README is wrong.
* Edit: none

### L5-mcp-docker-1-7 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 369-391
* Finding: Example completionRate 68 does not follow from 42 of 80 (`metrics.ts:133-135`).
* Decision: PROPOSE FIX
* Reason: Confirmed the formula.
* Edit: Changed 68 to 53.

### L5-mcp-docker-1-8 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 394-429
* Finding: Sort order of quadrant and tag analytics is not stated.
* Decision: DECLINE
* Reason: Omission, not an error.
* Edit: none

### L5-mcp-docker-1-9 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 323-345
* Finding: list_tasks example has a trailing comma and omits fields.
* Decision: PROPOSE FIX
* Reason: The comma makes the JSON invalid. The field list stays short on purpose.
* Edit: Removed the trailing comma only.

### L5-mcp-docker-1-10 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 291-306
* Finding: oldestTask and newestTask come from update times (`sync-status.ts:51-62`).
* Decision: DECLINE
* Reason: Field naming is a code matter; the README makes no claim about them.
* Edit: none

### L5-mcp-docker-1-11 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 538-549
* Finding: get_cache_stats example sizes cannot occur together (`cache.ts:131-138`).
* Decision: DECLINE
* Reason: Illustrative example.
* Edit: none

### L5-mcp-docker-1-12 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 497, 532
* Finding: Version labels v0.6.0 do not match CHANGELOG (cache is 0.7.0).
* Decision: DECLINE
* Reason: Historical labels; the changelog does not settle get_token_status.
* Edit: none

### L5-mcp-docker-1-13 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 156-157
* Finding: Linux config path missing (`src/cli/index.ts:89-92`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added the Linux path.

### L5-mcp-docker-1-14 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 20-25, 159-161
* Finding: Setup artifact is not named; its deletion is not mentioned (`setup-artifact.ts:19`, `startup.ts:51`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Named `~/.gsd-mcp-setup.json` and said when the server deletes it.

### L5-mcp-docker-1-15 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 108-112
* Finding: `--validate` does more than the list says.
* Decision: DECLINE
* Reason: Omission, not an error.
* Edit: none

### L5-mcp-docker-1-16 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 84-100
* Finding: Flag precedence not stated.
* Decision: DECLINE
* Reason: Not needed by a reader.
* Edit: none

### L5-mcp-docker-1-17 [accuracy A1] Severity: Nit
* Target: packages/mcp-server/README.md lines 142, 510
* Finding: Two menu paths for the token button. The README quotes the tool output correctly; the code string omits "MCP access" (`src/auth/token-status.ts:48`).
* Decision: ESCALATE
* Reason: The document is right on both lines. The difference is in the code's text. Listed under possible code defects.
* Edit: none

### L5-mcp-docker-1-18 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md lines 764-767
* Finding: "API request failed: 404 Not Found" comes only from the unused legacy client (`src/api/client.ts:36`).
* Decision: PROPOSE FIX
* Reason: Confirmed: no tool imports apiRequest.
* Edit: Replaced the entry with one for the write error codes.

### L5-mcp-docker-1-19 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md lines 736-774
* Finding: Troubleshooting omits the one-word codes write tools return (`write-rate-limiter.ts:12-26`, `handlers/index.ts:105-138`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: New entry names four codes and links the file that owns the full map.

### L5-mcp-docker-1-20 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md lines 560-715
* Finding: Write pacing, the 429 retry, and cache clearing are not documented.
* Decision: PROPOSE FIX
* Reason: Confirmed. Dependency cleanup after a delete does not clear the cache (`helpers.ts:231`, write-ops/README.md:89; issue #729).
* Edit: Added "Pacing and the cache" with today's behavior.

### L5-mcp-docker-1-21 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md line 886
* Finding: "Current release: 1.4.1" beside unreleased behavior.
* Decision: ESCALATE
* Reason: Same as L5-mcp-docker-1-4.
* Edit: none

### L5-mcp-docker-1-22 [accuracy A2] Severity: Major
* Target: packages/mcp-server/README.md lines 809-851
* Finding: Architecture tree omits source files.
* Decision: PROPOSE FIX
* Reason: Confirmed against `ls src`.
* Edit: Added the missing source files and CHANGELOG.md.

### L5-mcp-docker-1-23 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 738-740
* Finding: "Configuration error: Required environment variables" is two log lines.
* Decision: DECLINE
* Reason: The heading is recognizable.
* Edit: none

### L5-mcp-docker-1-24 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 758-759
* Finding: Bulk Saved refusal uses different text.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-1-25 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 685
* Finding: Saved refusal applies only when completing, and refuses the whole batch (`bulk-operations.ts:259-263`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Rewrote the note; added a Safety Features line.

### L5-mcp-docker-1-26 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 694-695
* Finding: Omitting dueDate also clears it (`bulk-operations.ts:39-44`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added "or omit it".

### L5-mcp-docker-1-27 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 690-693, 715
* Finding: add_tags can refuse the whole batch (`bulk-operations.ts:236-247`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Covered by the new Safety Features line.

### L5-mcp-docker-1-28 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 683, 699
* Finding: De-duplication, not-found errors, isError on partial results not stated.
* Decision: DECLINE
* Reason: Omissions.
* Edit: none

### L5-mcp-docker-1-29 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 648-665
* Finding: delete_task can partly succeed (`write-handlers.ts:144-160`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added one sentence to Returns.

### L5-mcp-docker-1-30 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 616-617
* Finding: Conflict window is the server's own read and write.
* Decision: PROPOSE FIX
* Reason: Confirmed (`task-operations.ts:290-318`).
* Edit: Reworded to "while the update runs".

### L5-mcp-docker-1-31 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 609
* Finding: Subtask id minimum length not stated.
* Decision: DECLINE
* Reason: Omission.
* Edit: none

### L5-mcp-docker-1-32 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md line 613
* Finding: notifyBefore default applies only on create.
* Decision: PROPOSE FIX
* Reason: Confirmed (`task-operations.ts:114, 219-222`).
* Edit: Added the exception.

### L5-mcp-docker-1-33 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 571, 582
* Finding: Tags are normalized, not rejected.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Reworded the parameter.

### L5-mcp-docker-1-34 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 580-586
* Finding: Three create_task behaviors missing.
* Decision: DECLINE
* Reason: Omissions.
* Edit: none

### L5-mcp-docker-1-35 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 638-641
* Finding: Two recurrence edge cases missing.
* Decision: DECLINE
* Reason: Omissions.
* Edit: none

### L5-mcp-docker-1-36 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 560-838
* Finding: Version tags do not match the changelog.
* Decision: DECLINE
* Reason: Historical labels.
* Edit: none

### L5-mcp-docker-1-37 [accuracy A2] Severity: Nit
* Target: packages/mcp-server/README.md lines 753, 820
* Finding: errors.ts also defines SuperuserPrincipalError; HTTPS message has more causes.
* Decision: PROPOSE FIX
* Reason: First half confirmed (`src/errors.ts`).
* Edit: Tree comment now names both errors. Second half declined.

### L5-mcp-docker-1-38 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 272-715, 832-837
* Finding: Tree says 20 tools; the sections document 19.
* Decision: PROPOSE FIX
* Reason: Same as L5-mcp-docker-1-1.
* Edit: See 1-1.

### L5-mcp-docker-1-39 [style S1] Severity: Major
* Target: packages/mcp-server/README.md line 6
* Finding: "self-hosted PocketBase backend" contradicts the hosted option.
* Decision: PROPOSE FIX
* Reason: Lines 184 and 730 describe both.
* Edit: Opening paragraph names both.

### L5-mcp-docker-1-40 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 874-876
* Finding: "experimental feature" and "PoC" beside a 1.4.1 release.
* Decision: ESCALATE
* Reason: Project status is the owner's statement.
* Edit: none

### L5-mcp-docker-1-41 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 142, 510, 744
* Finding: Two paths to the token button.
* Decision: ESCALATE
* Reason: Same as L5-mcp-docker-1-17.
* Edit: none

### L5-mcp-docker-1-42 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 39, 67, 249, 497, 838
* Finding: Version labels disagree.
* Decision: ESCALATE
* Reason: The changelog cannot settle each label, and they are historical. Owner can drop them.
* Edit: none

### L5-mcp-docker-1-43 [style S1] Severity: Major
* Target: packages/mcp-server/README.md line 258
* Finding: "real-time data" against a 30-second cache.
* Decision: PROPOSE FIX
* Reason: Cache TTL confirmed.
* Edit: Reworded and stated the 30 seconds.

### L5-mcp-docker-1-44 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 685, 715
* Finding: Saved items in a bulk complete: whole batch or per task?
* Decision: PROPOSE FIX
* Reason: Same as 1-25.
* Edit: See 1-25.

### L5-mcp-docker-1-45 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 32, 824
* Finding: Retry claim has no home in the tree.
* Decision: PROPOSE FIX
* Reason: Tree now lists write-rate-limiter.ts.
* Edit: See 1-22.

### L5-mcp-docker-1-46 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 20-25, 159-161
* Finding: Artifact has no name or location.
* Decision: PROPOSE FIX
* Reason: Same as 1-14.
* Edit: See 1-14.

### L5-mcp-docker-1-47 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 10, 24, 120
* Finding: "reviewed" release: by whom?
* Decision: ESCALATE
* Reason: Install policy wording is the owner's.
* Edit: none

### L5-mcp-docker-1-48 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 17-18
* Finding: "that exact version" is ambiguous.
* Decision: PROPOSE FIX
* Reason: Two versions precede it.
* Edit: Now "one exact version".

### L5-mcp-docker-1-49 [style S1] Severity: Major
* Target: packages/mcp-server/README.md line 749
* Finding: Quoted message has no source.
* Decision: PROPOSE FIX
* Reason: It is the second line of the same error (`pocketbase-client.ts:102-103`).
* Edit: Reworded.

### L5-mcp-docker-1-50 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 311-680
* Finding: "Requires authentication" label is unexplained.
* Decision: PROPOSE FIX
* Reason: Unlabelled tools catch the failure or make no call (sync-status.ts, system-handlers.ts).
* Edit: Added a three-sentence note under Available Tools.

### L5-mcp-docker-1-51 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 868-869
* Finding: At-rest protection on the hosted server is vague.
* Decision: ESCALATE
* Reason: The hosted server's configuration is not in the repo.
* Edit: none

### L5-mcp-docker-1-52 [style S1] Severity: Major
* Target: packages/mcp-server/README.md line 288
* Finding: "because PocketBase is live" cannot be followed.
* Decision: PROPOSE FIX
* Reason: `sync-status.ts:21` gives the reason.
* Edit: Reworded.

### L5-mcp-docker-1-53 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 160-161
* Finding: "terminal-oriented instructions" is unclear.
* Decision: PROPOSE FIX
* Reason: The wizard prints a redacted preview and writes the token to the file (`setup-wizard.ts:100-150`).
* Edit: Reworded.

### L5-mcp-docker-1-54 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 21-23
* Finding: npx sentence leaves the mechanism implicit.
* Decision: PROPOSE FIX
* Reason: Reworded without changing the claim.
* Edit: Reworded.

### L5-mcp-docker-1-55 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 264-270 and others
* Finding: "Saved" means a state and also "written".
* Decision: PROPOSE FIX
* Reason: Line 270 was open to both readings.
* Edit: Line 270 reworded. Dry-run "without saving" left as is.

### L5-mcp-docker-1-56 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 86, 108
* Finding: "tool" used for CLI flags.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Now "commands" and "Validation Features".

### L5-mcp-docker-1-57 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 23, 212, 746
* Finding: Several names for the token.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: "bearer token" and "MCP token" now read "auth token" in prose.

### L5-mcp-docker-1-58 [style S1] Severity: Major
* Target: packages/mcp-server/README.md lines 6-868
* Finding: Several names for the backend.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Opening paragraph defines hosted service and self-hosted.

### L5-mcp-docker-1-59 [style S1] Severity: Major
* Target: packages/mcp-server/README.md line 722
* Finding: "checklists" has no referent.
* Decision: PROPOSE FIX
* Reason: No such feature in the package.
* Edit: Removed the word.

### L5-mcp-docker-1-60 [accuracy A4] Severity: Blocker
* Target: packages/mcp-server/QUICKSTART.md lines 67-69
* Finding: "Show me all my connected devices": no device tool exists.
* Decision: PROPOSE FIX
* Reason: Confirmed in src/tools/schemas.
* Edit: Replaced with a token expiry prompt.

### L5-mcp-docker-1-61 [accuracy A4] Severity: Blocker
* Target: packages/mcp-server/QUICKSTART.md lines 83-85
* Finding: "401 Unauthorized" is never emitted (`pocketbase-client.ts:86-92`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Entry now uses the real message and the full remedy.

### L5-mcp-docker-1-62 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md lines 95-105
* Finding: Startup message is a JSON stderr line; debug needs LOG_LEVEL (`logger.ts:52`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added LOG_LEVEL=debug; reworded.

### L5-mcp-docker-1-63 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md lines 79-81
* Finding: Configuration error has more causes (`server/config.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added HTTPS, superuser, and --validate lines.

### L5-mcp-docker-1-64 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md lines 63-75
* Finding: Sync status answers normally when broken.
* Decision: PROPOSE FIX
* Reason: Confirmed (`sync-status.ts:23-30`).
* Edit: Added the healthy field check.

### L5-mcp-docker-1-65 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md whole file
* Finding: Omits --setup, --validate, get_token_status.
* Decision: PROPOSE FIX
* Reason: Partly: this file is the build-from-source path.
* Edit: Added --validate and a token prompt. Did not add --setup.

### L5-mcp-docker-1-66 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md line 18
* Finding: Apple sign-in missing.
* Decision: PROPOSE FIX
* Reason: README lists three providers.
* Edit: Added Apple.

### L5-mcp-docker-1-67 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md lines 19-22
* Finding: Token row details not stated.
* Decision: PROPOSE FIX
* Reason: Path lacked "MCP access" (`sync-auth-token-row.tsx:49`).
* Edit: Added "MCP access". Rest declined.

### L5-mcp-docker-1-68 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md line 115
* Finding: No project Discord exists in the repo.
* Decision: PROPOSE FIX
* Reason: package.json points to GitHub issues.
* Edit: Replaced with the issues URL.

### L5-mcp-docker-1-69 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md lines 26-28
* Finding: Linux path missing.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added.

### L5-mcp-docker-1-70 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICKSTART.md line 9
* Finding: `npm install` inside a Bun workspace is unpinned.
* Decision: DECLINE
* Reason: The README's Option B says the same; changing install advice is the owner's call.
* Edit: none

### L5-mcp-docker-1-71 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICK_TEST.md lines 56-59, 92
* Finding: delete_task defaults to a dry run (`task-operations.ts:412`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Prompts now pass dryRun false; added a warning line.

### L5-mcp-docker-1-72 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICK_TEST.md line 36
* Finding: validate_config has three checks.
* Decision: PROPOSE FIX
* Reason: Confirmed in system-handlers.ts.
* Edit: Named all three.

### L5-mcp-docker-1-73 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICK_TEST.md line 14
* Finding: Server key should be `gsd-tasks` (`setup-wizard.ts:111`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Renamed here and in TEST_PLAN.md.

### L5-mcp-docker-1-74 [accuracy A4] Severity: Major
* Target: packages/mcp-server/QUICK_TEST.md lines 114-118
* Finding: Rollback restores a backup this file never creates.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Added the backup command to Setup.

### L5-mcp-docker-1-75 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICK_TEST.md line 42
* Finding: list_tasks excludes Saved items.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-1-76 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICK_TEST.md line 78
* Finding: "#work" prompt.
* Decision: CONTEST
* Reason: The filter strips a leading `#` (`input-schemas.ts:34-46`), so the prompt works.
* Edit: none

### L5-mcp-docker-1-77 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICK_TEST.md lines 94-97
* Finding: Three of six prompts listed.
* Decision: DECLINE
* Reason: A sample, not a claim.
* Edit: none

### L5-mcp-docker-1-78 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICK_TEST.md line 65
* Finding: A prompt is a template; tool use is up to the client.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-1-79 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/QUICK_TEST.md whole file
* Finding: No smoke step for three tools.
* Decision: DECLINE
* Reason: A smoke test is a sample.
* Edit: none

### L5-mcp-docker-1-80 [accuracy A4] Severity: Blocker
* Target: packages/mcp-server/TESTING.md lines 94-99
* Finding: Device List test: no device tool.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Replaced with a Token Status block.

### L5-mcp-docker-1-81 [accuracy A4] Severity: Blocker
* Target: packages/mcp-server/TESTING.md lines 115-118
* Finding: Wrong-URL test asks for a device list and expects the wrong result.
* Decision: PROPOSE FIX
* Reason: Confirmed (`list-tasks.ts:90-97`, `server/config.ts`).
* Edit: Rewrote the test.

### L5-mcp-docker-1-82 [accuracy A4] Severity: Blocker
* Target: packages/mcp-server/TESTING.md lines 110-113, 175-178, 196
* Finding: "401" never appears; sync status does not error.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Rewrote the test, the issue heading, and the criterion.

### L5-mcp-docker-1-83 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 18-21
* Finding: Expected output is a JSON stderr line.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Reworded.

### L5-mcp-docker-1-84 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 87-92
* Finding: No last-sync time or conflict field.
* Decision: PROPOSE FIX
* Reason: Confirmed (`sync-status.ts:21`).
* Edit: Replaced the two questions.

### L5-mcp-docker-1-85 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 145-155
* Finding: `index.ts` has no name, args, or result in scope.
* Decision: PROPOSE FIX
* Reason: Confirmed in src/index.ts.
* Edit: Replaced with LOG_LEVEL=debug.

### L5-mcp-docker-1-86 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 139-143
* Finding: Server logs no tool calls or API traffic.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Removed the two bullets.

### L5-mcp-docker-1-87 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 180-183
* Finding: Null stats mean failure, not an empty account.
* Decision: PROPOSE FIX
* Reason: Confirmed (`sync-status.ts:36-73`).
* Edit: Added one bullet.

### L5-mcp-docker-1-88 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 3-69
* Finding: Omits --validate.
* Decision: PROPOSE FIX
* Reason: Confirmed (`src/index.ts`).
* Edit: Added one sentence.

### L5-mcp-docker-1-89 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md line 79
* Finding: `/mcp-tools` is not in the repo.
* Decision: PROPOSE FIX
* Reason: Also style 1-113.
* Edit: Replaced with a plain question.

### L5-mcp-docker-1-90 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 120-123
* Finding: Missing-config log lines.
* Decision: DECLINE
* Reason: Correct in substance.
* Edit: none

### L5-mcp-docker-1-91 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md line 188
* Finding: Node >= 18 is untested in CI.
* Decision: DECLINE
* Reason: Matches package.json engines.
* Edit: none

### L5-mcp-docker-1-92 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TESTING.md lines 15, 42
* Finding: Start deletes the setup artifact.
* Decision: DECLINE
* Reason: Covered in the README.
* Edit: none

### L5-mcp-docker-1-93 [accuracy A4] Severity: Blocker
* Target: packages/mcp-server/TEST_PLAN.md lines 114-116
* Finding: "List Devices" test: no device tool.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Replaced with a Token Status test.

### L5-mcp-docker-1-94 [accuracy A4] Severity: Blocker
* Target: packages/mcp-server/TEST_PLAN.md lines 227-233
* Finding: Publish is the tag workflow, not local `npm publish` (`.github/workflows/publish-mcp-server.yml`).
* Decision: PROPOSE FIX
* Reason: Confirmed in the workflow.
* Edit: Rewrote the publish steps here and in the README's Development section.

### L5-mcp-docker-1-95 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 81-82, 180-182
* Finding: Delete defaults to a dry run.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Prompts pass dryRun false.

### L5-mcp-docker-1-96 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 184-186
* Finding: Bulk caps and dry-run default not stated.
* Decision: CONTEST
* Reason: The test completes 3 tasks, which meets no cap and is not a delete (`write-tools.ts`). The plan claims nothing wrong.
* Edit: none

### L5-mcp-docker-1-97 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 62-64, 97-99
* Finding: validate_config has a third check.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added Task Access.

### L5-mcp-docker-1-98 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md line 34
* Finding: Entry name `gsd-mcp-server` matches nothing.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now `gsd-tasks`.

### L5-mcp-docker-1-99 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 92-209
* Finding: Suite omits three tools and three prompts.
* Decision: PROPOSE FIX
* Reason: Partly.
* Edit: Added tests 1.3 (cache stats), 2.2 (token status), 2.8 (top three). Prompts and edge cases not added.

### L5-mcp-docker-1-100 [accuracy A4] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 110-112
* Finding: Sync status pass needs healthy true.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Added the rule.

### L5-mcp-docker-1-101 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TEST_PLAN.md line 213
* Finding: Total of 30 matched no count.
* Decision: PROPOSE FIX
* Reason: After the added tests the quick suite has 5 and the full suite 25, so 30 is now right.
* Edit: none needed

### L5-mcp-docker-1-102 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TEST_PLAN.md lines 85-88
* Finding: Prompt is a template.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-1-103 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TEST_PLAN.md line 168
* Finding: `#test` is stored as `test`.
* Decision: DECLINE
* Reason: The prompt works.
* Edit: none

### L5-mcp-docker-1-104 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TEST_PLAN.md lines 205-207
* Finding: Invalid ID reply.
* Decision: DECLINE
* Reason: Correct as written.
* Edit: none

### L5-mcp-docker-1-105 [accuracy A4] Severity: Nit
* Target: packages/mcp-server/TEST_PLAN.md lines 14-20
* Finding: Explicit build is redundant.
* Decision: DECLINE
* Reason: Harmless.
* Edit: none

### L5-mcp-docker-1-106 [style S2] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md, packages/mcp-server/QUICK_TEST.md, packages/mcp-server/TEST_PLAN.md
* Finding: One server entry has three names.
* Decision: PROPOSE FIX
* Reason: Same as 1-73.
* Edit: See 1-73.

### L5-mcp-docker-1-107 [style S2] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md, packages/mcp-server/TESTING.md, packages/mcp-server/TEST_PLAN.md
* Finding: Device prompts have no tool.
* Decision: PROPOSE FIX
* Reason: Same as 1-60, 1-80, 1-93.
* Edit: See those.

### L5-mcp-docker-1-108 [style S2] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md lines 8, 38, 49-51
* Finding: Sample paths are the author's home directory.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Generic paths in all four files; the Important list says to replace the path.

### L5-mcp-docker-1-109 [style S2] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md line 84
* Finding: Remedy stops short.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: See 1-61.

### L5-mcp-docker-1-110 [style S2] Severity: Major
* Target: packages/mcp-server/QUICKSTART.md lines 111, 115
* Finding: Discord and "Report issues" have no referent.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: See 1-68.

### L5-mcp-docker-1-111 [style S2] Severity: Major
* Target: packages/mcp-server/QUICK_TEST.md lines 114-118
* Finding: Rollback without a backup.
* Decision: PROPOSE FIX
* Reason: Same as 1-74.
* Edit: See 1-74.

### L5-mcp-docker-1-112 [style S2] Severity: Major
* Target: packages/mcp-server/QUICK_TEST.md line 19
* Finding: YOUR_TOKEN has no source.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Added a pointer to QUICKSTART.md step 2.

### L5-mcp-docker-1-113 [style S2] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 79-81
* Finding: Step has no pass condition.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: See 1-89.

### L5-mcp-docker-1-114 [style S2] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 85, 193
* Finding: Procedure cannot meet "All tools".
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Both lines reworded.

### L5-mcp-docker-1-115 [style S2] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 147-155
* Finding: index.ts snippet has no location.
* Decision: PROPOSE FIX
* Reason: Same as 1-85.
* Edit: See 1-85.

### L5-mcp-docker-1-116 [style S2] Severity: Major
* Target: packages/mcp-server/TESTING.md line 178
* Finding: "check environment matches" is unclear.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Reworded.

### L5-mcp-docker-1-117 [style S2] Severity: Major
* Target: packages/mcp-server/TESTING.md line 176
* Finding: Incomplete remedy.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Reworded.

### L5-mcp-docker-1-118 [style S2] Severity: Major
* Target: packages/mcp-server/TESTING.md lines 27-69
* Finding: Piping one request with no initialize may not answer.
* Decision: ESCALATE
* Reason: Cannot be settled without running the server.
* Edit: none

### L5-mcp-docker-1-119 [style S2] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 6, 59, 92
* Finding: Durations disagree.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Line 6 gives both.

### L5-mcp-docker-1-120 [style S2] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md line 213
* Finding: 30 matches no count.
* Decision: PROPOSE FIX
* Reason: See 1-101.
* Edit: See 1-101.

### L5-mcp-docker-1-121 [style S2] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 219-221
* Finding: "critical" is never defined.
* Decision: ESCALATE
* Reason: Release criteria are the owner's.
* Edit: none

### L5-mcp-docker-1-122 [style S2] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 227-235
* Finding: Three decisions, two actions; PASS never restores the config.
* Decision: PROPOSE FIX
* Reason: Partly.
* Edit: Publish text now says to restore the config. The decision mapping is escalated with 1-121.

### L5-mcp-docker-1-123 [style S2] Severity: Major
* Target: packages/mcp-server/TEST_PLAN.md lines 190-199
* Finding: Phase 5 has no prompt text.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Added the three prompts.

### L5-mcp-docker-1-124 [style S2] Severity: Blocker
* Target: docker/README.md lines 186-189
* Finding: "To reset" under Sessions and Tokens deletes all data.
* Decision: PROPOSE FIX
* Reason: `docker compose down -v` removes the pb_data volume.
* Edit: Moved to Data Persistence and named what it deletes.

### L5-mcp-docker-1-125 [style S2] Severity: Major
* Target: docker/README.md lines 49-50, 164-168, 193
* Finding: Do migrations create `tasks`?
* Decision: PROPOSE FIX
* Reason: No migration creates it; the setup script does (pb_migrations, pb_fresh_migrations).
* Edit: Stated it in First-Time PocketBase Setup.

### L5-mcp-docker-1-126 [style S2] Severity: Major
* Target: docker/README.md lines 164-168
* Finding: Migration paragraph cannot be followed.
* Decision: PROPOSE FIX
* Reason: Rewrote from `docker/lib/migrations.sh` and the entrypoint.
* Edit: Rewrote. Removed the phrase about pending encryption cleanup.

### L5-mcp-docker-1-127 [style S2] Severity: Major
* Target: docker/README.md lines 73-76, 250
* Finding: Redirect URL missing from setup step 4.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Added to step 4.

### L5-mcp-docker-1-128 [style S2] Severity: Major
* Target: docker/README.md line 103
* Finding: Env instruction contradicts Quick Start.
* Decision: PROPOSE FIX
* Reason: Compose forwards only listed variables (`docker-compose.yml:18-22`).
* Edit: Rewrote.

### L5-mcp-docker-1-129 [style S2] Severity: Major
* Target: docker/README.md lines 56-65
* Finding: Step 2 names no file.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Named docker-compose.yml.

### L5-mcp-docker-1-130 [style S2] Severity: Major
* Target: docker/README.md lines 95-97
* Finding: "by default" and "now" have no referent.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Reworded.

### L5-mcp-docker-1-131 [style S2] Severity: Major
* Target: docs/diagrams/reminder-model/README.md lines 19, 24
* Finding: Five rules, four named.
* Decision: PROPOSE FIX
* Reason: TypeOK is the fifth (all cfg files).
* Edit: Named TypeOK.

### L5-mcp-docker-1-132 [style S2] Severity: Major
* Target: docs/diagrams/reminder-model/README.md lines 19, 30
* Finding: "state" used for model states and chart labels; 41 unexplained.
* Decision: PROPOSE FIX
* Reason: `.claude/skills/verify-reminders/SKILL.md:36` records 76. The generator prints 41 (`generate-reminder-statechart.py:428`).
* Edit: Chart now has "labels"; 41 is tied to the model before D-10; noted that the generator still prints 41.

### L5-mcp-docker-1-133 [style S2] Severity: Major
* Target: docs/diagrams/reminder-model/README.md line 30
* Finding: "Read every result": which results?
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Now "each check.sh result".

### L5-mcp-docker-1-134 [style S2] Severity: Major
* Target: docs/diagrams/reminder-model/README.md line 40
* Finding: Paragraph on the offset's value cannot be followed.
* Decision: ESCALATE
* Reason: A rewrite needs the model author's intent.
* Edit: none

### L5-mcp-docker-1-135 [style S2] Severity: Major
* Target: docs/diagrams/task-lifecycle-model/README.md lines 5, 56
* Finding: "so it has no verify skill"; skills are not under docs/formal.
* Decision: PROPOSE FIX
* Reason: Skills are in `.claude/skills/verify-*`; docs/formal holds models.
* Edit: Both lines reworded.

### L5-mcp-docker-1-136 [style S2] Severity: Major
* Target: docs/diagrams/task-lifecycle-model/README.md line 14
* Finding: "the report" has no referent.
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Now "the statechart skill's written report". No command added.

### L5-mcp-docker-1-137 [style S2] Severity: Major
* Target: docs/diagrams/task-lifecycle-model/README.md lines 25, 37, 39
* Finding: Undecided and also "bug path".
* Decision: PROPOSE FIX
* Reason: Valid.
* Edit: Line 39 now says "the path to each broken rule".

### L5-mcp-docker-1-138 [accuracy A3] Severity: Major
* Target: docker/README.md lines 152-158
* Finding: Custom version needs both checksum args (`Dockerfile:47-59`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Rewrote the section.

### L5-mcp-docker-1-139 [accuracy A3] Severity: Major
* Target: docker/README.md lines 96-97, 117-119
* Finding: Build cannot receive NEXT_PUBLIC_POCKETBASE_URL.
* Decision: PROPOSE FIX
* Reason: Confirmed: no ARG or ENV; `.dockerignore:24-25`.
* Edit: Stated what the Dockerfile does.

### L5-mcp-docker-1-140 [accuracy A3] Severity: Major
* Target: docker/README.md lines 197-224
* Finding: Table omits focus_date and focus_rank.
* Decision: PROPOSE FIX
* Reason: Confirmed (`setup-pocketbase-collections.sh:296, 304`).
* Edit: Added two rows.

### L5-mcp-docker-1-141 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 203-214
* Finding: Bool defaults are not schema properties.
* Decision: PROPOSE FIX
* Reason: Partly. `lib/tasks/crud/create.ts:82` sets true.
* Edit: notification_enabled note reworded. False defaults left.

### L5-mcp-docker-1-142 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 197-224
* Finding: Constraints omitted.
* Decision: DECLINE
* Reason: The table says it is a reference.
* Edit: none

### L5-mcp-docker-1-143 [accuracy A3] Severity: Nit
* Target: docker/README.md line 103
* Finding: Compose forwards only two variables.
* Decision: PROPOSE FIX
* Reason: Same as 1-128.
* Edit: See 1-128.

### L5-mcp-docker-1-144 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 99-112
* Finding: TMPDIR and npmrc secret not documented.
* Decision: DECLINE
* Reason: The contract section covers npmrc.
* Edit: none

### L5-mcp-docker-1-145 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 66-72
* Finding: Script needs curl and python3.
* Decision: PROPOSE FIX
* Reason: Confirmed in the script.
* Edit: Added to step 3.

### L5-mcp-docker-1-146 [accuracy A3] Severity: Nit
* Target: docker/README.md lines 186-189
* Finding: Reset command in the wrong section.
* Decision: PROPOSE FIX
* Reason: Same as 1-124.
* Edit: See 1-124.

### L5-mcp-docker-1-147 [accuracy A3] Severity: Nit
* Target: docker/README.md line 250
* Finding: CSP form-action has no Apple origin (`Caddyfile:53`).
* Decision: ESCALATE
* Reason: Cannot tell from the code whether it affects Apple sign-in.
* Edit: none

### L5-mcp-docker-1-148 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md lines 30-32
* Finding: Generator prints 41 and 52.
* Decision: PROPOSE FIX
* Reason: Same as 1-132.
* Edit: See 1-132.

### L5-mcp-docker-1-149 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 3
* Finding: Not every action has a comment.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-1-150 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 24
* Finding: TypeOK has no breaking config.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Now "each of those four rules".

### L5-mcp-docker-1-151 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 13
* Finding: check.sh also prints a summary line.
* Decision: PROPOSE FIX
* Reason: Confirmed (`check.sh:49-52`).
* Edit: Added.

### L5-mcp-docker-1-152 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md lines 20, 22
* Finding: Guards live in private helpers.
* Decision: DECLINE
* Reason: Not wrong.
* Edit: none

### L5-mcp-docker-1-153 [accuracy A3] Severity: Nit
* Target: docs/diagrams/reminder-model/README.md line 26
* Finding: Stored value is undefined, not null.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-1-154 [accuracy A3] Severity: Major
* Target: docs/diagrams/task-lifecycle-model/README.md lines 12-14, 33-37
* Finding: `scripts/tlc.sh` stops at the first broken rule, so the documented run cannot show both breaks or the table's counts.
* Decision: PROPOSE FIX
* Reason: tlc.sh passes no `-continue` (`scripts/tlc.sh:72-73`). Where the table's counts come from is escalated.
* Edit: Added one sentence after the run commands.

### L5-mcp-docker-1-155 [accuracy A3] Severity: Nit
* Target: docs/diagrams/task-lifecycle-model/README.md line 48
* Finding: Cache path is a default; Java 21 is the skill's need.
* Decision: DECLINE
* Reason: Small.
* Edit: none

### L5-mcp-docker-1-156 [accuracy A3] Severity: Nit
* Target: docs/diagrams/task-lifecycle-model/README.md line 56
* Finding: Verify skills are not under docs/formal.
* Decision: PROPOSE FIX
* Reason: Same as 1-135.
* Edit: See 1-135.

### L5-mcp-docker-1-157 [accuracy A3] Severity: Nit
* Target: docs/diagrams/task-lifecycle-model/README.md line 52
* Finding: "one arrow" unverified.
* Decision: DECLINE
* Reason: Cannot check without running.
* Edit: none

## Also fixed (known differences from the task message)

* docker/README.md: the diagram now notes the paths Caddy answers with 404 (`docker/Caddyfile`).
* docker/README.md: "self-signed" now reads as Caddy's internal CA (`tls internal`), in two places.
* packages/mcp-server/README.md "Publishing to npm": rewritten to the tag workflow, same evidence as finding 94.

## Notes

* Line numbers are the reviewers', from before the fixes.
* Edits used a text-replacement helper kept in the session scratchpad, outside the repo.
