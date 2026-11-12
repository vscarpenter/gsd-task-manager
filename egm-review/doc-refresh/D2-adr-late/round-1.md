# Doc refresh: D2-adr-late, round 1

Status: resolved
Clean round: no

All ten files are mode NOTE. The resolver opened the cited code for every PROPOSE FIX before writing. Each fix is one status note under the ADR's status block. No original ADR text changed.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | ADR 0013, 0015 | ran |
| egm-codebase-details | ADR 0016, 0018, 0019, 0020 | ran |
| egm-codebase-details | ADR 0014 | ran |
| egm-codebase-details | ADR 0011, 0012, 0017 | ran |

## Findings

### ADR 0011

### D2-adr-late-1-1 [codebase-details] Severity: Major
* Target: 0011 line 27
* Finding: `share-task-dialog` is listed as deleted. `components/share-task-dialog/` exists and `components/matrix-simplified/index.tsx:18,396` mounts it.
* Decision: PROPOSE FIX
* Reason: Confirmed in the code. The "Later changes" section does not cover it.
* Edit: status note added.

### D2-adr-late-1-2 [codebase-details] Severity: Major
* Target: 0011 line 37
* Finding: `snooze-dropdown.tsx` no longer exists. `components/task-card/task-card-actions.tsx:210` defines `SnoozeSubmenu` inline.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-3 [codebase-details] Severity: Major
* Target: 0011 lines 23, 51
* Finding: smart-view UI is back as `components/matrix-simplified/smart-view-strip.tsx` (mounted at `index.tsx:345`), with a toggle in `components/settings/feature-settings.tsx:18`.
* Decision: PROPOSE FIX
* Reason: Confirmed. The deleted v8 files stay deleted, so the note says "returned as an opt-in strip".
* Edit: status note.

### D2-adr-late-1-4 [codebase-details] Severity: Major
* Target: 0011 line 40
* Finding: `import-dialog.tsx` is lazy-loaded by `components/settings-page/settings-body.tsx:35`, not `settings-page/index.tsx`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-5 [codebase-details] Severity: Nit
* Target: 0011 lines 74-76
* Finding: the combobox follow-up looks done and `tasks/todo.md` no longer tracks it.
* Decision: DECLINE
* Reason: The reviewer could not confirm the semantics are "full". Not worth a claim.
* Edit: none

### D2-adr-late-1-6 [codebase-details] Severity: Nit
* Target: 0011 line 30
* Finding: `@types/canvas-confetti` is back in `package.json`.
* Decision: DECLINE
* Reason: "Later changes" already says `canvas-confetti` is back.
* Edit: none

### D2-adr-late-1-7 [codebase-details] Severity: Nit
* Target: 0011 line 33
* Finding: the palette re-mount is no longer tracked in `tasks/todo.md`.
* Decision: DECLINE
* Reason: "Later changes" says the palette is mounted.
* Edit: none

### D2-adr-late-1-8 [codebase-details] Severity: Nit
* Target: 0011 line 38
* Finding: `task-description.tsx` has two more importers.
* Decision: DECLINE
* Reason: The named importer is still right.
* Edit: none

### ADR 0012

### D2-adr-late-1-9 [codebase-details] Severity: Major
* Target: 0012 line 26
* Finding: runtime is an allowlist now. `lib/sw-cache-logic.ts:51-65` returns `passthrough` for any same-origin GET outside `/manifest.json`, `/theme-init.js`, `/favicon.svg`, `/icons/`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-10 [codebase-details] Severity: Major
* Target: 0012 lines 23-27
* Finding: `lib/sw-cache-logic.ts:27-36` passes through `/api`, `/_`, Authorization-header, and `no-store` requests before the other rules. `public/sw.js:115` handles a share-target POST.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-11 [codebase-details] Severity: Nit
* Target: 0012 line 34
* Finding: "27 unit tests" is now 45 in `tests/data/sw-cache-logic.test.ts`.
* Decision: PROPOSE FIX
* Reason: Counted 45 `it(` lines. Folded into the note.
* Edit: status note.

### D2-adr-late-1-12 [codebase-details] Severity: Nit
* Target: 0012 line 48
* Finding: "230-line file" is now 349 lines (`public/sw.js`).
* Decision: PROPOSE FIX
* Reason: Confirmed with `wc -l`.
* Edit: status note.

### D2-adr-late-1-13 [codebase-details] Severity: Nit
* Target: 0012 lines 17-19
* Finding: precache, `ignoreVary`, fallbacks, and activation purge are not in the table.
* Decision: DECLINE
* Reason: Detail that belongs in `.claude/rules/sw-cache.md`, not in the decision record.
* Edit: none

### ADR 0013

### D2-adr-late-1-14 [codebase-details] Severity: Blocker
* Target: 0013 line 43
* Finding: Migration v15 is in `lib/db-migrations.ts:207-232`, not `lib/db.ts`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-15 [codebase-details] Severity: Major
* Target: 0013 lines 33-43
* Finding: the writer table lists 7 writers and the code has many more.
* Decision: CONTEST
* Reason: Line 7 of the ADR already says the current writer list lives in `.claude/rules/archive-tombstone.md`. That existing note covers it.
* Edit: none

### D2-adr-late-1-16 [codebase-details] Severity: Major
* Target: 0013 line 27 (rule 2)
* Finding: `isRemoteNewerThanArchive` rejects a far-future stamp (`lib/sync/pb-sync-helpers.ts:310`). The restored row goes through `mapOverLocalCopy`. It must also beat a live local row.
* Decision: PROPOSE FIX
* Reason: Confirmed in `pb-sync-helpers.ts` and `pb-pull.ts:160`.
* Edit: status note (far-future limit and `mapOverLocalCopy`).

### D2-adr-late-1-17 [codebase-details] Severity: Nit
* Target: 0013 lines 13, 41
* Finding: the guard body moved to `applyPreparedRecord` (`lib/sync/pb-pull.ts:147-172`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-18 [codebase-details] Severity: Nit
* Target: 0013 lines 11, 15, 29, 31, 43, 57
* Finding: six small drifts (auto-archive schedule with sync on, `bulkPut`, merge-mode import under rule 4, v15 also trims titles, per-record reads, past-tense search claim).
* Decision: DECLINE
* Reason: Context text or detail the rule file owns. The merge-mode import case is under "Possible code defects".
* Edit: none

### ADR 0015

### D2-adr-late-1-19 [codebase-details] Severity: Major
* Target: 0015 lines 34, 67-68
* Finding: a signed-out delete queues nothing and remembers the id (`lib/tasks/crud/delete.ts:35-36`). `resurrectOnSight` can move it out of Trash (`lib/sync/resurrect-on-sight.ts:107-111`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-20 [codebase-details] Severity: Major
* Target: 0015 lines 34, 75-79
* Finding: sync writes into Trash: `reconcileDeletedTasks` (`lib/sync/pb-pull.ts:344`) and `applyRemoteDeletion` (`lib/sync/pb-sync-engine.ts:57-60`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-21 [codebase-details] Severity: Major
* Target: 0015 lines 48-49
* Finding: Trash moves also scope `syncMetadata` (`lib/trash.ts:55`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-22 [codebase-details] Severity: Nit
* Target: 0015 line 60
* Finding: the purge runs on mount and hourly (`runScheduledCheck` and `useAutoArchive` in `lib/use-auto-archive.ts`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Folded into the note.
* Edit: status note.

### D2-adr-late-1-23 [codebase-details] Severity: Nit
* Target: 0015 lines 38, 39-40, 52-56, 96-99
* Finding: four small drifts (database now v17, archive and Trash restore differ, far-future limit, import skip rules).
* Decision: DECLINE
* Reason: None misleads a reader about the decision.
* Edit: none

### D2-adr-late-1-24 [codebase-details] Severity: Major (reported as "code may break the ADR's rule")
* Target: 0013 rule 1, 0015 lines 44-50
* Finding: a backup import can leave one id in two lifecycle tables (`lib/tasks/import-export.ts:373-395`, `244-296`).
* Decision: ESCALATE
* Reason: The ADR states the rule and the code breaks it. Listed under "Possible code defects". No note blesses it.
* Edit: none

### D2-adr-late-1-25 [codebase-details] Severity: Major (reported as "code may break a stated rule")
* Target: `lib/sync/resurrect-ids.ts:24-26`, `.claude/rules/pocketbase-sync.md`
* Finding: three ways out of Trash do not forget the resurrect id: `lib/sync/pb-pull.ts:168`, `lib/sync/pb-sync-engine.ts:134`, `lib/tasks/import-export.ts:284`.
* Decision: ESCALATE
* Reason: Confirmed, no `forgetForResurrect` call on those paths. The rule lives in the code comment and the sync rule file, not in ADR 0013 or 0015. Listed under "Possible code defects".
* Edit: none

### ADR 0014

### D2-adr-late-1-26 [codebase-details] Severity: Major
* Target: 0014 lines 38-53, 62-73, 122
* Finding: the envelope carries `deletedTasks` (`lib/tasks/import-export.ts:192-195`), so export reads seven stores.
* Decision: PROPOSE FIX
* Reason: Confirmed. The "Amended" note does not cover it.
* Edit: status note.

### D2-adr-late-1-27 [codebase-details] Severity: Major
* Target: 0014 lines 85-92, 103-104
* Finding: no `deletedTasks` row in the import table. The import transaction scopes `deletedTasks` too (`import-export.ts:359-369`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-28 [codebase-details] Severity: Major
* Target: 0014 line 91
* Finding: a Merge overwrites a smart view whose id exists (`import-export.ts:316-328`).
* Decision: PROPOSE FIX
* Reason: Confirmed. No skip for an existing id.
* Edit: status note.

### D2-adr-late-1-29 [codebase-details] Severity: Major
* Target: 0014 lines 89-91
* Finding: a Replace leaves the archive, Trash, and smart views alone when the key is absent (`import-export.ts:250, 282, 309`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-30 [codebase-details] Severity: Major
* Target: 0014 lines 48, 66
* Finding: smart views are validated one row at a time in `applySmartViews`, with a cap.
* Decision: PROPOSE FIX
* Reason: Confirmed at `import-export.ts:300-331`.
* Edit: status note (one clause).

### D2-adr-late-1-31 [codebase-details] Severity: Major
* Target: 0014 lines 83-96
* Finding: import gives a task with no `notifyBefore` the default reminder (`import-export.ts:454-458`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note (one clause).

### D2-adr-late-1-32 [codebase-details] Severity: Major
* Target: 0014 lines 207-210
* Finding: "`MAX_IMPORT_TASKS` still counts `tasks` only" is stale.
* Decision: CONTEST
* Reason: The existing "Amended" note at line 9 states the cap now counts all three (`assertWithinImportCap`, `import-export.ts:405-415`).
* Edit: none

### D2-adr-late-1-33 [codebase-details] Severity: Major
* Target: 0014 lines 44, 188-191
* Finding: version `2.0.0` and "both clients settle on 2.1.0". Export writes `2.2.0`.
* Decision: CONTEST
* Reason: The "Amended" note covers the web version. The iOS side is outside this repo and the reviewer did not confirm it.
* Edit: none

### D2-adr-late-1-34 [codebase-details] Severity: Nit
* Target: 0014 lines 105-107, 47, 126
* Finding: the dropped-archive count is logged only. `archivedAt` is optional in the schema.
* Decision: DECLINE
* Reason: Small. Not opened by the resolver.
* Edit: none

### ADR 0016

### D2-adr-late-1-35 [codebase-details] Severity: Major
* Target: 0016 lines 21-23
* Finding: "no hooks directory". Web sign-in uses `/api/gsd/oauth-callback` (`lib/sync/oauth-callback.ts:19`, `lib/sync/pb-auth.ts:190`), served only by `docker/pb_hooks/oauth_web_redirect.pb.js:17`. Two code comments say hosted loads no repo hooks (`lib/sync/pb-account-deletion.ts:18`, `lib/sync/sign-out-everywhere.ts:7`).
* Decision: ESCALATE
* Reason: The repo holds evidence both ways and cannot show what the live server loads. Owner question.
* Edit: none

### D2-adr-late-1-36 [codebase-details] Severity: Major
* Target: 0016 lines 55-57, 64-66
* Finding: both Docker folders hold more than encryption now, so step 2 would change more than encryption.
* Decision: PROPOSE FIX
* Reason: Confirmed by listing both folders and their first-commit dates. `docker/pb_migrations/1794061500_top_three.js:5-7` warns against pointing hosted at the folder.
* Edit: status note. It states repo facts only and makes no claim about the live server.

### D2-adr-late-1-37 [codebase-details] Severity: Nit
* Target: 0016 line 64
* Finding: four encryption migrations, where the ADR names one.
* Decision: PROPOSE FIX
* Reason: Three predate the ADR. The note mentions only the fourth (2026-10-14).
* Edit: status note (one clause).

### D2-adr-late-1-38 [codebase-details] Severity: Nit
* Target: 0016 lines 42-43, 51-52
* Finding: the pinned test covers one sentence. Other tests also exercise the hooks.
* Decision: DECLINE
* Reason: Small. The asserted strings and the ADR path are unchanged.
* Edit: none

### ADR 0018

### D2-adr-late-1-39 [codebase-details] Severity: Major
* Target: 0018 line 3, lines 38-43
* Finding: the status says iOS and hosted rollout are pending. ADR 0019 lines 7-10 record both as done.
* Decision: PROPOSE FIX
* Reason: `gsd-iosapp/GSDKit/Sources/GSDModel/Task.swift:29` holds `savedAt`. The hosted fact is cited to ADR 0019, not asserted.
* Edit: status note. Status line untouched.

### D2-adr-late-1-40 [codebase-details] Severity: Major
* Target: 0018 lines 33-35
* Finding: "Deploy the backend migration" conflicts with the rule that hosted never runs `docker/pb_migrations`. `scripts/update-pocketbase-tasks-schema.sh:177` does not verify `saved_at`.
* Decision: ESCALATE
* Reason: How `saved_at` reached the hosted collection cannot be read from the repo.
* Edit: none

### D2-adr-late-1-41 [codebase-details] Severity: Major
* Target: 0018 whole document
* Finding: no mention of the pull contract and push work Saved needed.
* Decision: PROPOSE FIX
* Reason: `lib/constants/sync.ts:64-71`. The note points to ADR 0019 and ADR 0020.
* Edit: status note.

### D2-adr-late-1-42 [codebase-details] Severity: Nit
* Target: 0018 lines 11-15
* Finding: saving refuses a completed task (`lib/tasks/saved-placement.ts:9`). Escalation, auto-archive, top three, and the weekly sweep treat Saved specially (`lib/escalation.ts:49`, `lib/archive.ts:93`, `lib/top-three.ts:87`, `lib/weekly-sweep.ts:91-92`).
* Decision: PROPOSE FIX
* Reason: All five lines confirmed.
* Edit: status note.

### D2-adr-late-1-43 [codebase-details] Severity: Nit
* Target: 0018 lines 22-23
* Finding: `listTasksFresh` keeps Saved for write preflights.
* Decision: DECLINE
* Reason: Consistent with the ADR's "full graph" sentence.
* Edit: none

### ADR 0019

### D2-adr-late-1-44 [codebase-details] Severity: Major
* Target: 0019 lines 23-25
* Finding: backfill runs only for a missing or lower version (`lib/sync/pb-sync-engine.ts:180-181`).
* Decision: PROPOSE FIX
* Reason: Confirmed. The status line says "narrowed by ADR 0020" but the body reads as current.
* Edit: status note.

### D2-adr-late-1-45 [codebase-details] Severity: Major
* Target: 0019 line 28
* Finding: push changed: pull-first during a backfill (`pb-sync-engine.ts:195-209`), and `saved_at` from the current row (`lib/sync/pb-push.ts:158-161`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-46 [codebase-details] Severity: Major
* Target: 0019 lines 25-26
* Finding: a local row that wins copies only unread fields (`lib/sync/pb-pull.ts:124-133`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-47 [codebase-details] Severity: Nit
* Target: 0019 line 30
* Finding: the constant is 4 (`lib/constants/sync.ts:64`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-48 [codebase-details] Severity: Nit
* Target: 0019 lines 27, 38
* Finding: a backfill sync is more than one request. Three non-sync writers stamp the version.
* Decision: DECLINE
* Reason: The stampers are noted on ADR 0020, which owns that rule.
* Edit: none

### ADR 0020

### D2-adr-late-1-49 [codebase-details] Severity: Major
* Target: 0020 line 11
* Finding: `sprint/findings/saved-at-exposure.md` is not in the repo.
* Decision: PROPOSE FIX
* Reason: The file exists at `/Users/vinnycarpenter/Projects/GSD/sprint/findings/saved-at-exposure.md`, in the workspace folder beside the repo.
* Edit: status note.

### D2-adr-late-1-50 [codebase-details] Severity: Major
* Target: 0020 lines 22-24
* Finding: "only a completed pull stamps one". `lib/reset-local-data.ts:40` and `lib/db-migrations.ts:82,152` also write the current version.
* Decision: PROPOSE FIX
* Reason: Confirmed. All three create a signed-out config. `tasks/spec-top-three.md:167` records them as safe, so this is not a defect.
* Edit: status note.

### D2-adr-late-1-51 [codebase-details] Severity: Nit
* Target: 0020 lines 35-37
* Finding: the hold-off runs on every pull (`pb-pull.ts:143`) and on realtime (`pb-sync-engine.ts:81`). Only pending rows count (`pb-sync-helpers.ts:296`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-52 [codebase-details] Severity: Nit
* Target: 0020 line 59
* Finding: `pb-record-shape.json` is at `tests/fixtures/pinned-copies/`.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: status note.

### D2-adr-late-1-53 [codebase-details] Severity: Nit
* Target: 0020 lines 22-24, 34-35, 41-43
* Finding: "completed pull" means `pullResult.authenticated`. `unreadFieldRepair` ignores a rank-only difference.
* Decision: DECLINE
* Reason: Implementation detail.
* Edit: none

### ADR 0017

### D2-adr-late-1-54 [codebase-details] Severity: Nit
* Target: 0017 lines 31-34
* Finding: one MCP fatal path logs plain text. The Docker CSP names no OAuth origin.
* Decision: DECLINE
* Reason: The decision holds: no Sentry dependency, DSN, or CSP origin remains.
* Edit: none
