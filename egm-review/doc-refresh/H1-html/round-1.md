# Doc refresh: H1-html, round 1

Status: resolved
Clean round: no

Pre-round check: no test reads either file. `tests/data/documentation-currentness.test.ts` reads `docs/security-trust-boundaries.md` and ADR 0016 only. A repo search for `architecture.html` and `cloud-sync-explainer` found only `tasks/audit-2026-11-10.md` (DOC-1, DOC-20), `tasks/todo.md`, and `docs/diagrams/` tooling, which works on a different file (`docs/diagrams/architecture.html`).

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details | docs/architecture.html | ran, 12 Blocker, 24 Major, 7 Nit |
| egm-codebase-details | docs/cloud-sync-explainer.html | ran, 8 Blocker, 9 Major, 7 Nit |
| egm-style | docs/architecture.html | ran, 12 Major |
| egm-style | docs/cloud-sync-explainer.html | ran, 12 Major |

Abbreviations: ARCH is `docs/architecture.html`, SYNC is `docs/cloud-sync-explainer.html`. Line numbers are from the files as they stood before this round's edits.

## Findings: docs/architecture.html, accuracy

### H1-html-1-1 [codebase-details] Severity: Blocker
* Target: ARCH lines 133, 189-190, 197-198, 416
* Finding: "schema v14, 10 tables". Code is at version 17 with 11 tables (`lib/db-migrations.ts:231-236`, `lib/db.ts:14-25`).
* Decision: PROPOSE FIX
* Reason: Confirmed in both files.
* Edit: v14 to v17 in the TL;DR, stat card, and heading. 10 to 11 tables in the TL;DR and stat card.

### H1-html-1-2 [codebase-details] Severity: Blocker
* Target: ARCH lines 420-429
* Finding: Schema table omits `deletedTasks`. The `tasks` index list omits `savedAt` and others (`lib/db-migrations.ts:17-25,52,236`).
* Decision: PROPOSE FIX
* Reason: Confirmed `DELETED_TASKS` and the v17 `savedAt` index.
* Edit: Added one `deletedTasks` row (sibling markup). Added `savedAt` to the `tasks` row. The column is "Key Indexes", so the other indexes stay out.

### H1-html-1-3 [codebase-details] Severity: Blocker
* Target: ARCH line 421
* Finding: `archivedTasks` indexes "Same as tasks". They are `quadrant, completed, dueDate, completedAt, archivedAt` (`lib/db-migrations.ts:23`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Listed the real indexes.

### H1-html-1-4 [codebase-details] Severity: Blocker
* Target: ARCH lines 274-279
* Finding: "Gap: Edit Drawer accessibility" says no `aria-modal` and no focus trap. `components/matrix-simplified/edit-drawer.tsx:105,139-140` has both.
* Decision: PROPOSE FIX
* Reason: Confirmed `role="dialog"`, `aria-modal="true"`, and `useDialogFocus`.
* Edit: Removed the warning alert. Added one sentence about the drawer to the "What works well" alert.

### H1-html-1-5 [codebase-details] Severity: Blocker
* Target: ARCH line 235
* Finding: "`Tab` cycles quadrant". `capture-bar.tsx` has no Tab handler. Tab reaches the quadrant button (`help-drawer-sections.tsx:54`).
* Decision: PROPOSE FIX
* Reason: Confirmed the key handlers at `capture-bar.tsx:177-180,258`.
* Edit: "Tab reaches the quadrant button, which cycles the quadrant."

### H1-html-1-6 [codebase-details] Severity: Blocker
* Target: ARCH line 265
* Finding: No `(pwa)` route group. `/saved`, `/sweep`, and `/auth/callback` exist and are not listed.
* Decision: PROPOSE FIX
* Reason: Confirmed by listing `app/`.
* Edit: Rewrote the caption.

### H1-html-1-7 [codebase-details] Severity: Blocker
* Target: ARCH lines 387-399
* Finding: `QueryProvider` is not in the root chain. The chain is ErrorBoundary, ThemeProvider, ToastProvider, TooltipProvider, ResetLockGate, ClientLayout (`app/layout.tsx:212-234`).
* Decision: PROPOSE FIX
* Reason: Confirmed. `QueryProvider` is only in the archive and sync layouts.
* Edit: Changed two step labels. No step added or removed.

### H1-html-1-8 [codebase-details] Severity: Blocker
* Target: ARCH lines 496-501, 579
* Finding: "ADR-0011 documents deletions that never happened". The ADR now records that these came back on purpose (`docs/adr/0011-v9-single-matrix-refactor.md:7,80-85`).
* Decision: PROPOSE FIX
* Reason: Confirmed in the ADR.
* Edit: Replaced the two danger alerts under "Documentation vs. Reality" with one success alert that says both gaps are closed.

### H1-html-1-9 [codebase-details] Severity: Blocker
* Target: ARCH lines 502-507
* Finding: "CLAUDE.md says the command palette is not wired in" and "help drawer doesn't mention Cmd+K". Both false now (`CLAUDE.md`, `help-drawer-sections.tsx:171,235`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Covered by the alert in H1-html-1-8.

### H1-html-1-10 [codebase-details] Severity: Blocker
* Target: ARCH lines 571-576, 588
* Finding: "14 test files named coverage-boost.test.ts ...". No such files exist.
* Decision: PROPOSE FIX
* Reason: A file search for `coverage-boost`, `final-coverage`, and `gap-closing` found nothing.
* Edit: Removed the "Dead Weight" subsection (heading and both cards) and the matching hard question. See H1-html-1-11 for the second card.

### H1-html-1-11 [codebase-details] Severity: Blocker
* Target: ARCH lines 426, 579, 641
* Finding: `smartViews` "no UI surface". Smart views are back as an opt-in strip (`components/matrix-simplified/smart-view-strip.tsx`, ADR 0011 status note).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Schema row and ADR-0009 card corrected. The "Orphaned Features" card went with the "Dead Weight" subsection, since every item on it was stale.

### H1-html-1-12 [codebase-details] Severity: Blocker
* Target: ARCH line 461
* Finding: Push "Pre-fetch remote index". Push looks up each row (`pb-push.ts` `pushSingleItem`, `fetchRemoteTaskEntry`).
* Decision: PROPOSE FIX
* Reason: Confirmed in `.claude/rules/pocketbase-sync.md` and the push loop.
* Edit: "Per-row remote lookup, LWW guard before write, session check, abort on HTTP 429".

### H1-html-1-13 [codebase-details] Severity: Major
* Target: ARCH lines 136, 193, 212, 317, 625
* Finding: 19 tools in four places, 20 in one. Code has 20: 7 read, 5 write, 5 analytics, 3 system.
* Decision: PROPOSE FIX
* Reason: Counted the `name:` entries in `packages/mcp-server/src/tools/schemas/*.ts`: 7, 5, 5, 3.
* Edit: All set to 20. "6 read tools" to "7 read tools".

### H1-html-1-14 [codebase-details] Severity: Major
* Target: ARCH lines 206-210
* Finding: Stale versions.
* Decision: PROPOSE FIX
* Reason: `package.json`: next 16.4.1, dexie 4.4.6, pocketbase 0.28.1, zod 4.6.7, tailwindcss 4.3.3.
* Edit: Updated all five. The PocketBase cell now says "PocketBase SDK 0.28.1", since that is the number the repo pins.

### H1-html-1-15 [codebase-details] Severity: Major
* Target: ARCH lines 309, 512-513, 528, 587
* Finding: Sync file count and line count stale and inconsistent.
* Decision: PROPOSE FIX
* Reason: `lib/sync/` holds 26 source files plus 4 in `config/`. `wc -l` over them gives 5,510.
* Edit: Card says "26 source files plus a config/ folder". Stat cards and prose say 30 files and ~5,500 lines.

### H1-html-1-16 [codebase-details] Severity: Major
* Target: ARCH lines 519-521, 528
* Finding: edit-drawer.tsx "376 lines exceeds the 350-line ceiling". It is 466 raw lines. The ceiling is 400 lines without blanks and comments (`scripts/check-code-shape.cjs:39`).
* Decision: PROPOSE FIX
* Reason: Confirmed. `scripts/code-shape-debt.json` holds `"max-lines": 0`, so no file is over.
* Edit: Stat card 466. Sentence now says it passes the 400-line ceiling.

### H1-html-1-17 [codebase-details] Severity: Major
* Target: ARCH lines 523-525
* Finding: 16 overrides. `package.json` has 24.
* Decision: PROPOSE FIX
* Reason: Counted.
* Edit: 24.

### H1-html-1-18 [codebase-details] Severity: Major
* Target: ARCH lines 254-264
* Finding: Nav is Matrix, Saved, Review, Settings, About (`icon-rail.tsx:33-37`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Changed three step labels. Caption notes that Review is `/dashboard` and that Archive and sync history have no rail item.

### H1-html-1-19 [codebase-details] Severity: Major
* Target: ARCH line 252
* Finding: `/auth/callback` does not use AppShell.
* Decision: PROPOSE FIX
* Reason: Confirmed. Matrix, Saved, and Sweep mount it through their page components.
* Edit: "Every app page except the OAuth callback".

### H1-html-1-20 [codebase-details] Severity: Major
* Target: ARCH lines 280-285
* Finding: "Gap: Mobile discoverability" names three hidden features. Search is full width below `sm`, the grip shows on coarse pointers, and `SyncButton` always renders.
* Decision: PROPOSE FIX
* Reason: Confirmed at `topbar.tsx:91`, `task-card-header.tsx:182`, `sync-status-display.tsx:33`.
* Edit: Removed the alert.

### H1-html-1-21 [codebase-details] Severity: Major
* Target: ARCH line 243
* Finding: 8px is pointer only. Touch uses a 250 ms delay (`lib/constants.ts:51-53`).
* Decision: PROPOSE FIX
* Reason: Confirmed, and `lib/use-drag-and-drop.ts:56-60` uses both.
* Edit: Added the touch delay.

### H1-html-1-22 [codebase-details] Severity: Major
* Target: ARCH line 299
* Finding: "All components use use client". `app/layout.tsx` has no directive.
* Decision: PROPOSE FIX
* Reason: Confirmed. CLAUDE.md says the same.
* Edit: Rewrote the two sentences.

### H1-html-1-23 [codebase-details] Severity: Major
* Target: ARCH line 305
* Finding: `lib/` card: stale count, CRUD lives in `lib/tasks/`, more subdirectories.
* Decision: PROPOSE FIX
* Reason: `lib/` has 60 top-level files. `lib/tasks.ts` is a re-export.
* Edit: "About 60 top-level files", `tasks/` for CRUD, "Subdirectories include".

### H1-html-1-24 [codebase-details] Severity: Major
* Target: ARCH line 400
* Finding: Standalone list misses `OnboardingGate`, `ResetLockGate`, `ThemedToaster`.
* Decision: PROPOSE FIX
* Reason: Confirmed in `app/layout.tsx`.
* Edit: Rewrote the caption.

### H1-html-1-25 [codebase-details] Severity: Major
* Target: ARCH line 427
* Finding: `notificationSettings` is one global row, not per-task.
* Decision: PROPOSE FIX
* Reason: `lib/db-migrations.ts` keys it by `id`. Per-task values sit on the task (`lib/schema.ts:106`).
* Edit: "Global notification settings (one row)".

### H1-html-1-26 [codebase-details] Severity: Major
* Target: ARCH lines 438-446
* Finding: Field cards miss newer fields. `timeEntries` uses `startedAt`/`endedAt`.
* Decision: PROPOSE FIX
* Reason: Confirmed at `lib/schema.ts:91-92`.
* Edit: Fixed the `timeEntries` names. Added a pointer to `lib/schema.ts` for the full list. No new field list (the brief forbids lists that drift).

### H1-html-1-27 [codebase-details] Severity: Major
* Target: ARCH lines 454, 462
* Finding: LWW text stale: strictly newer, tombstones, hold-off missing.
* Decision: PROPOSE FIX
* Reason: `pb-pull.ts:73-77` and `lib/sync/README.md`.
* Edit: Alert says "strictly newer" and explains the 5-minute ceiling. Pull row adds tombstones.

### H1-html-1-28 [codebase-details] Severity: Major
* Target: ARCH line 464
* Finding: Delete reconciliation safeguards incomplete.
* Decision: PROPOSE FIX
* Reason: Confirmed in `pb-pull.ts` `reconcileDeletedTasks`.
* Edit: Added session confirmation and the Trash move.

### H1-html-1-29 [codebase-details] Severity: Major
* Target: ARCH line 473
* Finding: Export envelope is 2.2.0 with more keys.
* Decision: PROPOSE FIX
* Reason: `lib/tasks/import-export.ts:25,189-199`.
* Edit: Rewrote the sentence.

### H1-html-1-30 [codebase-details] Severity: Major
* Target: ARCH line 477
* Finding: The 10K cap counts live, archived, and trashed rows.
* Decision: PROPOSE FIX
* Reason: `assertWithinImportCap`.
* Edit: Clarified the limit.

### H1-html-1-31 [codebase-details] Severity: Major
* Target: ARCH lines 545-547
* Finding: "must be manually synced to JS copy". The copy is generated and a test guards drift.
* Decision: PROPOSE FIX
* Reason: `scripts/generate-sw-cache-logic.cjs` and `tests/data/sw-cache-logic-generated.test.ts` exist.
* Edit: Rewrote the cell.

### H1-html-1-32 [codebase-details] Severity: Major
* Target: ARCH line 366
* Finding: Build row wrong.
* Decision: PROPOSE FIX
* Reason: `package.json:14-15`, `scripts/build-static-export.sh:24`.
* Edit: Rewrote the row.

### H1-html-1-33 [codebase-details] Severity: Major
* Target: ARCH lines 561, 586
* Finding: "No encryption" is true for the hosted service only.
* Decision: PROPOSE FIX
* Reason: `SECURITY.md:106-121`, ADR 0016.
* Edit: Line 561 now names the hosted service and ADR 0016. Line 586 is a question about the hosted app and stays.

### H1-html-1-34 [codebase-details] Severity: Major
* Target: ARCH lines 566-567
* Finding: "long-lived", "rotation is not documented". Tokens last 30 days and the README documents expiry.
* Decision: PROPOSE FIX
* Reason: `packages/mcp-server/README.md:36,554`.
* Edit: Rewrote the sentence. The exposure concern stays.

### H1-html-1-35 [codebase-details] Severity: Major
* Target: ARCH lines 606-655
* Finding: ADR list stops at 0012. 20 ADRs exist.
* Decision: PROPOSE FIX
* Reason: Listed `docs/adr/` and read each title.
* Edit: Added eight cards (sibling markup) for 0013 to 0020.

### H1-html-1-36 [codebase-details] Severity: Major
* Target: ARCH whole document
* Finding: Many shipped features are absent (Trash, Saved, weekly sweep, top three, onboarding, account deletion, session fence).
* Decision: ESCALATE
* Reason: Covering them means new sections, which is a rewrite, not a text correction. This round's edits name Trash, Saved, sweep, and the ADRs. The owner should decide whether this page stays a living overview.
* Edit: none

### H1-html-1-37 [codebase-details] Severity: Nit
* Target: ARCH line 235
* Finding: `!!` marker missing.
* Decision: PROPOSE FIX
* Reason: `help-drawer-sections.tsx:57`.
* Edit: Added.

### H1-html-1-38 [codebase-details] Severity: Nit
* Target: ARCH line 239
* Finding: Edit drawer field list incomplete.
* Decision: DECLINE
* Reason: The list reads as examples.
* Edit: none

### H1-html-1-39 [codebase-details] Severity: Nit
* Target: ARCH line 317
* Finding: MCP "retry logic" is legacy.
* Decision: PROPOSE FIX
* Reason: `.claude/rules/mcp-server.md:30`. Only `src/api/` references `fetchWithRetry`.
* Edit: Removed "retry logic".

### H1-html-1-40 [codebase-details] Severity: Nit
* Target: ARCH line 378
* Finding: Pages cache fallback not mentioned.
* Decision: DECLINE
* Reason: Detail belongs in `.claude/rules/sw-cache.md`.
* Edit: none

### H1-html-1-41 [codebase-details] Severity: Nit
* Target: ARCH line 465
* Finding: "Bidirectional Zod validation with .strip()" unverified.
* Decision: PROPOSE FIX
* Reason: `task-mapper.ts:238` validates pulled records with `pbTaskRecordSchema`. The outbound mapper does not validate.
* Edit: "Zod validation of every pulled record (pbTaskRecordSchema)".

### H1-html-1-42 [codebase-details] Severity: Nit
* Target: ARCH line 649
* Finding: "Simplified from ~30 files". The ADR removed about 30 files.
* Decision: PROPOSE FIX
* Reason: ADR 0011.
* Edit: "Removed about 30 files".

### H1-html-1-43 [codebase-details] Severity: Nit
* Target: ARCH lines 667-668
* Finding: Duplicate closing `</body></html>`.
* Decision: DECLINE
* Reason: Markup, outside a text-only batch. Browsers ignore it. Reported in the summary.
* Edit: none

## Findings: docs/architecture.html, style

### H1-html-1-44 [style] Severity: Major
* Target: ARCH lines 136, 194, 212, 317, 625
* Finding: Tool count contradiction.
* Decision: PROPOSE FIX
* Reason: Same as H1-html-1-13.
* Edit: See H1-html-1-13.

### H1-html-1-45 [style] Severity: Major
* Target: ARCH lines 309, 512-513, 528, 587
* Finding: Sync file count contradiction.
* Decision: PROPOSE FIX
* Reason: Same as H1-html-1-15.
* Edit: See H1-html-1-15.

### H1-html-1-46 [style] Severity: Major
* Target: ARCH lines 137, 540-542, 585
* Finding: The backup question is asked after it is answered.
* Decision: ESCALATE
* Reason: The backup state of the production server is not in the repo. See H1-html-1-56.
* Edit: none

### H1-html-1-47 [style] Severity: Major
* Target: ARCH lines 571-575, 588
* Finding: Coverage tests asserted, then questioned.
* Decision: PROPOSE FIX
* Reason: The files do not exist.
* Edit: Both removed (H1-html-1-10).

### H1-html-1-48 [style] Severity: Major
* Target: ARCH lines 420-421
* Finding: "Active tasks" beside a `completed` index.
* Decision: PROPOSE FIX
* Reason: `tasks` holds open and completed tasks until auto-archive moves them.
* Edit: "Live tasks, open and completed" and "Archived tasks (ADR-0013)".

### H1-html-1-49 [style] Severity: Major
* Target: ARCH lines 299, 378, 135
* Finding: "no server rendering" against "RSC flight data". Hydration claims.
* Decision: PROPOSE FIX
* Reason: Same code facts as H1-html-1-22.
* Edit: Line 299 rewritten. "no hydration complexity" removed from the TL;DR.

### H1-html-1-50 [style] Severity: Major
* Target: ARCH lines 133, 162, 228, 313, 416, 422, 426, 641, 649
* Finding: Bare "vN" covers schema versions and the v9 UI.
* Decision: PROPOSE FIX
* Reason: ADR 0011 defines v9 as the UI refactor.
* Edit: First use now reads "The v9 UI (app version 9, ADR-0011)". The `syncQueue` cell says "schema v14". The `smartViews` cell no longer says "v8".

### H1-html-1-51 [style] Severity: Major
* Target: ARCH line 585
* Finding: `api.vinny.io` has no referent.
* Decision: PROPOSE FIX
* Reason: CLAUDE.md names it as the PocketBase host.
* Edit: Added "(the PocketBase host)".

### H1-html-1-52 [style] Severity: Major
* Target: ARCH lines 136, 317, 400, 589, 645
* Finding: "MCP server requires cloud sync" first appears in a question.
* Decision: PROPOSE FIX
* Reason: The server reads PocketBase (`packages/mcp-server/src/pocketbase-client.ts`).
* Edit: Added one sentence to the MCP card. The WebMCP and ADR-0010 relationship is left alone.

### H1-html-1-53 [style] Severity: Major
* Target: ARCH lines 350, 354, 454
* Finding: "future clamp" undefined. Flow labels name modules the list omits.
* Decision: PROPOSE FIX
* Reason: `task-mapper.ts:clampClientTimestamp`. `pb-push.ts` and `pb-pull.ts` exist.
* Edit: Clamp explained. Module card now lists both files.

### H1-html-1-54 [style] Severity: Major
* Target: ARCH lines 532, 542, 547
* Finding: "Mitigation" column holds non-mitigations.
* Decision: PROPOSE FIX
* Reason: The service worker cell is now a real mitigation (H1-html-1-31). The backup cell is hosting state, see H1-html-1-56.
* Edit: Service worker cell only.

### H1-html-1-55 [style] Severity: Major
* Target: ARCH line 660
* Finding: Footer date conflicts with the content.
* Decision: PROPOSE FIX
* Reason: The numbers are now as of this refresh.
* Edit: Added "Facts corrected against the code on 2026-11-12." The generation date and design system version stay.

### H1-html-1-56 [driver] Severity: Major
* Target: ARCH lines 137, 535-542, 585
* Finding: "PocketBase on single EC2", "No automated PocketBase backup", "no backup scripts or S3 snapshots". Neither reviewer could check these. The repo shows only a manual `docker cp` backup (`docker/README.md:206`).
* Decision: ESCALATE
* Reason: Hosting state is not in the code.
* Edit: none

## Findings: docs/cloud-sync-explainer.html, accuracy

### H1-html-1-57 [codebase-details] Severity: Blocker
* Target: SYNC lines 386, 638-642, 811-812, 888
* Finding: "ties go to remote", LWW `>=`. Code keeps the local copy on a tie (`pb-pull.ts:73-77` `acceptsRemoteVersion`, `pb-sync-engine.ts` `localCopyHolds`).
* Decision: PROPOSE FIX
* Reason: Confirmed both functions.
* Edit: Card, pull sample, gotcha, and lesson 04 now say a strictly newer remote wins, with the backfill exception.

### H1-html-1-58 [codebase-details] Severity: Blocker
* Target: SYNC lines 455-456, 506, 516-531
* Finding: The page teaches `authWithOAuth2({ provider })`, which the code forbids (`pb-auth.ts` `runCodeFlow`, `.claude/rules/pocketbase-sync.md`). This is DOC-1 in `tasks/audit-2026-11-10.md`.
* Decision: PROPOSE FIX
* Reason: Confirmed `runCodeFlow` uses `listAuthMethods`, `waitForOAuthCallback`, `authWithOAuth2Code`.
* Edit: Rewrote the auth paragraph, the diagram's two auth labels, and the sample (now marked simplified, calls `runCodeFlow`).

### H1-html-1-59 [codebase-details] Severity: Blocker
* Target: SYNC lines 454, 514, 537
* Finding: Two providers. The allowlist has three (`pb-auth.ts:49`).
* Decision: PROPOSE FIX
* Reason: Confirmed. `components/sync/oauth-buttons.tsx` imports `loginWithApple`.
* Edit: Diagram label, sample, and alert.

### H1-html-1-60 [codebase-details] Severity: Blocker
* Target: SYNC lines 572-594
* Finding: Push sample shows a pre-fetched index, a no-argument signature, and calls that no longer exist.
* Decision: PROPOSE FIX
* Reason: Read `pb-push.ts:412-473`.
* Edit: Rewrote the sample as a marked simplification of the current loop.

### H1-html-1-61 [codebase-details] Severity: Blocker
* Target: SYNC lines 832-833
* Finding: "Deletes are reconciled, not pushed individually" is false. Reconcile also moves retry-exhausted tasks to Trash.
* Decision: PROPOSE FIX
* Reason: `pb-pull.ts` `planRemoteAbsence`, `reconcileDeletedTasks`, `queue.ts` `classifyRemoteDeletion`. `lib/sync/README.md` names `pushDelete`.
* Edit: Rewrote the gotcha as "Deletes travel two ways".

### H1-html-1-62 [codebase-details] Severity: Blocker
* Target: SYNC lines 479, 622-647
* Finding: Pull sample: wrong parameter, `>` for `>=`, wrong sort, wrong fetch call, a merge loop that does not exist.
* Decision: PROPOSE FIX
* Reason: Read `pb-pull.ts:214-260`.
* Edit: Rewrote the sample and the diagram label.

### H1-html-1-63 [codebase-details] Severity: Blocker
* Target: SYNC line 847
* Finding: The local dev tip does not work. Production OAuth completes only on gsd.vinny.dev.
* Decision: PROPOSE FIX
* Reason: `.claude/rules/pocketbase-sync.md` and `docker/pb_hooks/oauth_web_redirect.pb.js:9-11,20`.
* Edit: Rewrote the tip.

### H1-html-1-64 [codebase-details] Severity: Blocker
* Target: SYNC lines 691-709
* Finding: `realtimeRecordShape` does not exist. Field names and the `applyRemoteChange` arguments are wrong.
* Decision: PROPOSE FIX
* Reason: `pb-realtime.ts:87-118`, `task-mapper.ts:102-118`.
* Edit: Rewrote the sample.

### H1-html-1-65 [codebase-details] Severity: Major
* Target: SYNC lines 512, 543, 571, 621, 658, 690, 736
* Finding: Every `file:line` reference is wrong.
* Decision: PROPOSE FIX
* Reason: Checked each against the file.
* Edit: Replaced line numbers with symbol names (`file.ts:symbol`), as the repo READMEs do. The table cell keeps the file name only.

### H1-html-1-66 [codebase-details] Severity: Major
* Target: SYNC lines 441-445, 615
* Finding: `fullSync` steps wrong. The cursor is `lastClientUpdatedAt`.
* Decision: PROPOSE FIX
* Reason: `pb-sync-engine.ts:223-263`.
* Edit: Four diagram labels and the pull paragraph. The paragraph adds the backfill order (ADR 0020).

### H1-html-1-67 [codebase-details] Severity: Major
* Target: SYNC lines 723-724, 755-757
* Finding: The health monitor does not call `requestSync()`.
* Decision: PROPOSE FIX
* Reason: The only callers are `sync-provider.tsx:56` and `background-sync.ts:186`.
* Edit: Paragraph and table row.

### H1-html-1-68 [codebase-details] Severity: Major
* Target: SYNC lines 565, 745-747
* Finding: A mutation schedules a debounced sync. Write and enqueue share one transaction.
* Decision: PROPOSE FIX
* Reason: `lib/tasks/crud/helpers.ts:22-27,66-91`.
* Edit: Push paragraph and table row.

### H1-html-1-69 [codebase-details] Severity: Major
* Target: SYNC lines 507, 522
* Finding: The app refreshes the token, not the SDK.
* Decision: PROPOSE FIX
* Reason: `pb-sync-engine.ts:242`, `pb-auth.ts:412`.
* Edit: Auth paragraph.

### H1-html-1-70 [codebase-details] Severity: Major
* Target: SYNC lines 653, 666-668, 819
* Finding: The due-date reset is missing. `parentTaskId` is not in the sample.
* Decision: PROPOSE FIX
* Reason: `task-mapper.ts:214-223,274`.
* Edit: Paragraph, sample, and gotcha.

### H1-html-1-71 [codebase-details] Severity: Major
* Target: SYNC line 601
* Finding: "Failed items are visible in the sync history UI for manual recovery". No reader of failed queue rows exists in `components/` or `app/`.
* Decision: PROPOSE FIX
* Reason: A search found only `health-monitor.ts`, which raises a `failed_items` issue.
* Edit: Sentence now says the health check reports them and nothing re-arms a failed row. See "Possible code defects" for the health message.

### H1-html-1-72 [codebase-details] Severity: Major
* Target: SYNC lines 709, 869, 888
* Finding: "same LWW merge" hides the backfill difference.
* Decision: PROPOSE FIX
* Reason: `pb-pull.ts:73-77`, `pb-sync-engine.ts:75-89`.
* Edit: TL;DR item 4, lesson 04, and the sample comment.

### H1-html-1-73 [codebase-details] Severity: Major
* Target: SYNC whole document
* Finding: Session fence, far-future hold-off, pull contract backfill, tombstones, resurrect on sight are absent.
* Decision: ESCALATE
* Reason: This round names each of them in one place, with no new section. Full coverage is a rewrite. `lib/sync/README.md` already holds the detail.
* Edit: none beyond the mentions above.

### H1-html-1-74 [codebase-details] Severity: Nit
* Target: SYNC line 684
* Finding: Realtime reaches the owner's clients only.
* Decision: PROPOSE FIX
* Reason: `scripts/setup-pocketbase-collections.sh:86-87`, `pb-realtime.ts:106-109`.
* Edit: Realtime paragraph.

### H1-html-1-75 [codebase-details] Severity: Nit
* Target: SYNC lines 547-548
* Finding: Singleton comment text is not in the file.
* Decision: PROPOSE FIX
* Reason: `pocketbase-client.ts:22`.
* Edit: Sample comment.

### H1-html-1-76 [codebase-details] Severity: Nit
* Target: SYNC line 590
* Finding: "stable code only" belongs to `recordItemFailure`.
* Decision: PROPOSE FIX
* Reason: `pb-push.ts` push loop.
* Edit: The comment now sits on the `recordItemFailure` line.

### H1-html-1-77 [codebase-details] Severity: Nit
* Target: SYNC line 840
* Finding: `queue.lastError` wording.
* Decision: PROPOSE FIX
* Reason: `queue.ts` stores `lastError` on the row.
* Edit: "a queue row's lastError or the sync history".

### H1-html-1-78 [codebase-details] Severity: Nit
* Target: SYNC line 812
* Finding: The cursor rationale no longer applies.
* Decision: PROPOSE FIX
* Reason: `pb-pull.ts:229-232`.
* Edit: Part of the gotcha rewrite.

### H1-html-1-79 [codebase-details] Severity: Nit
* Target: SYNC line 742
* Finding: Auto sync has more gates than backoff.
* Decision: DECLINE
* Reason: The cell is correct as far as it goes.
* Edit: none

### H1-html-1-80 [codebase-details] Severity: Nit
* Target: SYNC line 348
* Finding: `api.vinny.io` applies to production or a set env var.
* Decision: DECLINE
* Reason: The lede describes the hosted product.
* Edit: none

## Findings: docs/cloud-sync-explainer.html, style

### H1-html-1-81 [style] Severity: Major
* Target: SYNC lines 378, 386, 812, 833, 866, 876
* Finding: "Source of truth" used two ways.
* Decision: CONTEST
* Reason: `lib/sync/README.md` Overview says "IndexedDB stays the source of truth". The tie claims that caused the conflict are gone (H1-html-1-57).
* Edit: none beyond H1-html-1-57

### H1-html-1-82 [style] Severity: Major
* Target: SYNC lines 428, 476, 832-833
* Finding: How deletes travel is contradictory.
* Decision: PROPOSE FIX
* Reason: Same as H1-html-1-61.
* Edit: See H1-html-1-61.

### H1-html-1-83 [style] Severity: Major
* Target: SYNC lines 442-445, 647, 833
* Finding: Where `reconcileDeletedTasks()` runs is stated two ways.
* Decision: PROPOSE FIX
* Reason: It runs inside pull (`pb-pull.ts:256`).
* Edit: Diagram step 2 now reads "push, then pull + reconcile". The gotcha says reconcile fetches the remote index.

### H1-html-1-84 [style] Severity: Major
* Target: SYNC lines 601, 833
* Finding: "pending" ambiguous.
* Decision: PROPOSE FIX
* Reason: `queue.ts` `classifyRemoteDeletion`.
* Edit: The gotcha says "pending queue row" and states what happens to retry-exhausted rows.

### H1-html-1-85 [style] Severity: Major
* Target: SYNC lines 723-724, 755-757
* Finding: Health monitor contradiction.
* Decision: PROPOSE FIX
* Reason: Same as H1-html-1-67.
* Edit: See H1-html-1-67.

### H1-html-1-86 [style] Severity: Major
* Target: SYNC lines 382, 390, 683, 747, 869
* Finding: Four names for the periodic mechanism. "next tick" has no referent.
* Decision: PROPOSE FIX
* Reason: `background-sync.ts` triggers.
* Edit: "pull loop" and "next tick" are gone. The card and table name the triggers.

### H1-html-1-87 [style] Severity: Major
* Target: SYNC lines 705-706, 826
* Finding: The echo-filter explanation does not follow from the code shown.
* Decision: PROPOSE FIX
* Reason: `pb-realtime.ts:96-99`. The schema allows an empty `device_id` (`task-mapper.ts:105`).
* Edit: Gotcha now describes two empty ids. The sample comment is the existing one and stays.

### H1-html-1-88 [style] Severity: Major
* Target: SYNC lines 812, 630, 479
* Finding: "the same invariant the pull cursor relies on" has no referent.
* Decision: PROPOSE FIX
* Reason: Same as H1-html-1-78.
* Edit: See H1-html-1-78.

### H1-html-1-89 [style] Severity: Major
* Target: SYNC lines 777, 867, 642
* Finding: Universal timestamp claim contradicted by the sample.
* Decision: PROPOSE FIX
* Reason: The rule is about remote filter and sort (`.claude/rules/pocketbase-sync.md`).
* Edit: Both sentences now say "every remote filter and sort".

### H1-html-1-90 [style] Severity: Major
* Target: SYNC lines 653, 666-668, 818-819
* Finding: Device-local field list inconsistent.
* Decision: PROPOSE FIX
* Reason: Same as H1-html-1-70.
* Edit: See H1-html-1-70.

### H1-html-1-91 [style] Severity: Major
* Target: SYNC lines 461, 683-684, 707
* Finding: Realtime scope conflicts with the owner rule.
* Decision: PROPOSE FIX
* Reason: Same as H1-html-1-74.
* Edit: See H1-html-1-74.

### H1-html-1-92 [style] Severity: Major
* Target: SYNC lines 536-537, 547-548, 797-798
* Finding: Two rationale claims the code shown does not support.
* Decision: PROPOSE FIX
* Reason: `pb-auth.ts:40-49` comment, `pocketbase-client.ts:22`.
* Edit: Allowlist alert and auto-cancellation gotcha reworded to what the code guards.

## Removed this round
* ARCH: the "Gap: Edit Drawer accessibility" and "Gap: Mobile discoverability" alerts, the two "Documentation vs. Reality" danger alerts (replaced by one success alert), the "Dead Weight" subsection (two cards), and one hard question.
* SYNC: no element removed. Four code samples rewritten in place.

## Tool notes
* The design hook flagged pre-existing CSS in SYNC (11px text, font names). This batch is text only, so those stand untouched and no ignore was added.
* The ARCH corrections went in through one find-and-replace pass that failed on any string that did not match exactly once.
