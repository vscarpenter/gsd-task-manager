# Doc refresh: H2-html, round 1

Status: resolved
Clean round: no

Pre-round check: `rg` for the three file names found no test that reads `docs/privacy-data-flow.html`, `docs/pipeline-summary.html`, or `docs/codebase-analysis-report.html`. `tests/data/editorial-theme.test.ts:190,195` reads `public/docs/codebase-analysis-report.html`, the shipped mirror, which this batch does not touch. Before the banner the two report copies were byte-identical (`cmp`). They now differ by the banner line.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm:egm-codebase-details | docs/privacy-data-flow.html | ran |
| egm:egm-codebase-details | docs/pipeline-summary.html | ran |
| egm:egm-style | both FIX files | ran |
| egm:egm-codebase-details | docs/codebase-analysis-report.html lines 12-120 | ran |

## Findings: docs/privacy-data-flow.html

### H2-html-1-1 [codebase-details] Severity: Blocker
* Target: privacy-data-flow.html lines 154, 258, 462-485, 547, 558
* Finding: Sentry is shown as a live egress path. No Sentry code or package exists (`lib/error-logger.ts:28-33` logs to the console only; ADR 0017).
* Decision: PROPOSE FIX
* Reason: Confirmed by `rg -il sentry` (only tests and a changelog match) and `lib/error-logger.ts`.
* Edit: Removed the three Sentry table rows and the Sentry diagram box. Rewrote the SVG desc, the trackers note, and the fourth claim's last bullet to say Sentry was removed.

### H2-html-1-2 [codebase-details] Severity: Blocker
* Target: lines 262, 456, 546
* Finding: The CSP allowlist is listed as four origins in `app/layout.tsx`. `config/csp.cjs:7,24-27` and `cloudfront/response-headers-policy.json` allow three (api.vinny.io, accounts.google.com, github.com); the production policy is a response header; the self-host target allows only its own origin.
* Decision: PROPOSE FIX
* Reason: Confirmed in `config/csp.cjs` and the CloudFront policy JSON.
* Edit: Corrected the SVG footnote, row 21, and the claim bullet. Row 21 and the bullet now link `config/csp.cjs` on `main`.

### H2-html-1-3 [codebase-details] Severity: Blocker
* Target: lines 552-558
* Finding: The "Needs attention" claim quotes about-page copy that is gone. `components/about/features-section.tsx:88-92`, `privacy-section.tsx:5-7`, and `mcp-section.tsx:17-19` hold corrected copy.
* Decision: PROPOSE FIX
* Reason: Confirmed by reading the three components.
* Edit: Rewrote the claim as "Formerly stated in-app", verdict text "Corrected in the app", with the current copy. The card keeps its `attention` and `warn` classes (see H2-html-1-20).

### H2-html-1-4 [codebase-details] Severity: Blocker
* Target: lines 143, 221-225, 408, 538, 553
* Finding: "No application-level encryption anywhere" ignores the self-hosted image. `docker/pb_hooks/encryption-core.js:7-8` encrypts five fields and `docker/docker-entrypoint.sh:6-7` refuses to boot without a key. The hosted service stores plaintext (`SECURITY.md:104-112`, ADR 0016).
* Decision: PROPOSE FIX
* Reason: Confirmed in the Docker hooks and SECURITY.md.
* Edit: Section note, the IN TRANSIT label, the warning line, row 15, and the caveat callout now split hosted from self-hosted. Dropped the unverifiable AES/PBKDF2 sentence.

### H2-html-1-5 [codebase-details] Severity: Major
* Target: diagram and table, network zone
* Finding: The feedback form is missing. `lib/feedback/submit-feedback.ts:50-60` posts to the sync server with no auth and no cookies; `lib/feedback/feedback-payload.ts:38-46` lists seven fields, none from tasks.
* Decision: PROPOSE FIX
* Reason: Confirmed in both files.
* Edit: Added table row 22 (markup copied from a sibling row), reused the freed Sentry diagram box for it, and named it in the section note and SVG desc.

### H2-html-1-6 [codebase-details] Severity: Major
* Target: line 522
* Finding: `app/layout.tsx:250` emits a preconnect to api.vinny.io on every page, sync on or off.
* Decision: PROPOSE FIX
* Reason: Confirmed at `app/layout.tsx:250`.
* Edit: Added table row 23, one sentence in the local-first claim, and a clause in the section note. Also listed under possible code defects, because the host is hard-coded.

### H2-html-1-7 [codebase-details] Severity: Major
* Target: lines 256, 448, 547
* Finding: OAuth providers are Google, GitHub, and Apple, and the call is `authWithOAuth2Code` (`lib/sync/pb-auth.ts:21,49,203`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Diagram box, row 20, and the trackers note.

### H2-html-1-8 [codebase-details] Severity: Major
* Target: lines 191, 330
* Finding: IndexedDB is at version 17 and `deletedTasks` also holds full records (`lib/db-migrations.ts:236`, `lib/db.ts:17`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Diagram label and row 6.

### H2-html-1-9 [codebase-details] Severity: Major
* Target: line 408
* Finding: "maps 24 fields" is stale (`lib/sync/task-mapper.ts:129-158`).
* Decision: PROPOSE FIX
* Reason: Confirmed. Replaced the count with wording that will not drift, and added time entries.
* Edit: Row 15.

### H2-html-1-10 [codebase-details] Severity: Major
* Target: lines 424, 346
* Finding: Pull pages with `getList` (`lib/sync/pb-sync-helpers.ts:126`); archive writes with `bulkPut` (`lib/archive.ts:114`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Rows 17 and 8.

### H2-html-1-11 [codebase-details] Severity: Major
* Target: lines 362-374
* Finding: Export covers live, archived, and trashed tasks plus smart views and settings (`lib/tasks/import-export.ts:181-199`). Import runs through `importFromJson` and writes the same stores (`import-export.ts:467-479`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Rows 10 and 11. Pinned link labels left as they are.

### H2-html-1-12 [codebase-details] Severity: Major
* Target: lines 538, 573
* Finding: The footer calls the backend "self-hosted ... not a third party". The default backend is the hosted service run by the developer (`components/about/privacy-section.tsx:6`, `SECURITY.md:104-112`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Caveat callout and the runtime-caveats paragraph.

### H2-html-1-13 [codebase-details] Severity: Major
* Target: line 534
* Finding: `app/` holds 9 pages, 3 layouts, `global-error.tsx`, and `not-found.tsx`, not 10 files.
* Decision: PROPOSE FIX
* Reason: Counted with `find app`.
* Edit: "holds 14 page, layout, global-error, and not-found files".

### H2-html-1-14 [codebase-details] Severity: Major
* Target: whole page
* Finding: Flows missing from the page: WebMCP `create_task` registration (`components/webmcp-register.tsx`), `syncQueue` as a second plaintext copy, auth-token copy to the clipboard, the share dialog (`components/share-task-dialog/index.tsx:64,79`), and account deletion (`lib/sync/pb-account-deletion.ts`).
* Decision: ESCALATE
* Reason: Each is real, but adding five rows changes the page's scope, which the owner set. Trash is now covered in row 6.
* Edit: none

### H2-html-1-15 [codebase-details] Severity: Nit
* Target: lines 322, 378, 440
* Finding: Subtasks validate with `subtaskSchema` (`lib/tasks/subtasks.ts:35`); the 6 console sites split 4 and 2 across `lib/logger.ts` and `lib/error-logger.ts`, and the logger masks task-content keys (`lib/logger.ts:131,149`); row 19 "nothing transmits".
* Decision: PROPOSE FIX
* Reason: Confirmed; each was a one-clause change.
* Edit: Rows 5, 12, 19.

### H2-html-1-16 [codebase-details] Severity: Nit
* Target: lines 338, 496, 504, 544
* Finding: `useTasks` now filters through a schema; `JSON.stringify(tasks, null, 2)`; MCP writes go through `write-ops/helpers.ts`; CSP enforcement comes from host headers.
* Decision: DECLINE
* Reason: The rows remain true at the level of detail the page uses.
* Edit: none

### H2-html-1-17 [style] Severity: Major
* Target: lines 144, 154, 404, 440, 573 (D1)
* Finding: The "opt-in only" red zone held a Sentry flow that was not opt-in.
* Decision: PROPOSE FIX
* Reason: Settled by removing Sentry and rewording the zone statements to "task content".
* Edit: As in 1-1, plus the network section header and the runtime caveat.

### H2-html-1-18 [style] Severity: Major
* Target: lines 531-538 (D2), 573 (D3), 262 (D5), 260 (D6)
* Finding: "server" means two things in one claim; the footer's definition of "encrypted at rest" contradicts the page; "the four boxes above" has no referent; the MCP diagram label reverses the flow in rows 25-26.
* Decision: PROPOSE FIX
* Reason: Each is an internal contradiction a wording change settles.
* Edit: "The Next.js app ... no server runtime"; footer explains the quote marks; footnote names the three origins; label now reads "PocketBase → MCP → Claude Desktop → Anthropic".

### H2-html-1-19 [style] Severity: Major
* Target: Zone column (D4); "personal data" versus "Content" (D7)
* Finding: The Zone column uses five values against a three-zone legend; the "Personal data" column records only task content.
* Decision: ESCALATE
* Reason: Fixing either means redefining the table's columns, a structural change outside a text-only pass. The "who hosts" part of D7 is fixed under 1-12.
* Edit: none

### H2-html-1-20 [resolver note] Severity: Nit
* Target: fourth claim card; zone tab "NETWORK / SERVER — OPT-IN ONLY"
* Finding: The corrected claim keeps amber `attention` styling, and the zone tab cannot take longer text without resizing its rect.
* Decision: ESCALATE
* Reason: Both need a class or geometry change, which the HTML rules for this run forbid.
* Edit: none

## Findings: docs/pipeline-summary.html

### H2-html-1-21 [codebase-details] Severity: Blocker
* Target: lines 122, 136-137, 150, 179, 183, 352, 379 (B1)
* Finding: The builder is described as live. `scripts/builder-run.sh` only prints a disabled notice and `.claude/commands/build-next.md` refuses to run (`docs/agents/builder.md`).
* Decision: PROPOSE FIX
* Reason: Confirmed in all three files. `git log` shows the script last changed on 2026-09-04 in PR #527.
* Edit: Rewrote the banner as "Current as of 2026-11-12", the lede, the meta description, the idea paragraph, and the key-components row. Added one caption under the delivery diagram. The diagram nodes are unchanged.

### H2-html-1-22 [codebase-details] Severity: Blocker
* Target: lines 233-252, 382 (B2, M4, M5)
* Finding: The night shift is described as reproducing, fixing, escalating, and reporting. `scripts/triage-run.sh` is discovery-only and exits unless `GSD_TRIAGE_BOT_LOGIN` is set; `scripts/failing-agent-prs.cjs:24-34` requires same-repo, the bot login, and a 40-hex head SHA; nothing posts to an issue.
* Decision: PROPOSE FIX
* Reason: Confirmed in both scripts.
* Edit: New section heading, four list items rewritten in the past tense with today's behavior, one caption under the diagram, key-components row, and the learning-loop panel sentence about where the provenance check lives.

### H2-html-1-23 [codebase-details] Severity: Blocker
* Target: lines 291-305, 384 (B3, M9)
* Finding: The MCP publish runs on `mcp-v*.*.*` tags (`publish-mcp-server.yml:4-7`), not `v*.*.*`. The Docker publish waits on the security audit job, not CI, and also runs on each push to `main` (`publish-docker.yml:6-7,13-17,28-35`).
* Decision: PROPOSE FIX
* Reason: Confirmed in both workflows.
* Edit: Heading "Two tags, three channels, and only two of them wait for a human", the intro sentence, the MCP and Docker cards, and the key-components row.

### H2-html-1-24 [codebase-details] Severity: Blocker
* Target: lines 337-344 (B4, B5)
* Finding: Nothing reads `builder:paused`; `triage:paused` matches any open issue and prints to stdout (`triage-run.sh:34-43`); no wrapper creates a worktree or starts an agent.
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Safety heading, the kill-switch sentence, and the worktree paragraph.

### H2-html-1-25 [codebase-details] Severity: Major
* Target: lines 137-141, 196 (M1)
* Finding: A Claude reviewer workflow exists: `.github/workflows/claude-code-review.yml` runs on each pull request. `git log` shows it was added on 2026-09-28 (PR #565).
* Decision: PROPOSE FIX
* Reason: Confirmed. `release-ready.yml` and `telemetry.yml` are absent, as the page says.
* Edit: Banner and the fourth delivery-loop bullet.

### H2-html-1-26 [codebase-details] Severity: Major
* Target: lines 193, 201-229, 320, 341 (M2, M3, M10)
* Finding: No script acts on risk labels or the plan labels (`docs/agents/builder.md`, `docs/ops/pipeline-audit.md:5`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Risk-tier bullet, state-machine heading and caption, learning-loop paragraph.

### H2-html-1-27 [codebase-details] Severity: Major
* Target: lines 263-272 (M6)
* Finding: The separation matrix ticks "Write code" and "Open PR" for both agents, and the prose claims separate credentials; `scripts/builder-run.sh:2-3` says the builder ran with maintainer credentials.
* Decision: PROPOSE FIX
* Reason: Confirmed. The cells need a class change to flip, so the caption carries the correction.
* Edit: Caption and prose paragraph. Table cells unchanged (see 1-32).

### H2-html-1-28 [codebase-details] Severity: Major
* Target: lines 150, 187, 195, 285 (M7); style P1
* Finding: Line 195 puts the merge after Gate 2; `docs/ops/gate2.md:22-31` and `deploy-production-release.yml:202-209` put Gate 2 after the merge and the tag. No hosted preview exists since the dev deploy retired (`gate2.md:15-17`; `deploy-dev.yml` is absent).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: Builder bullet, idea paragraph, Gate 2 node label ("release evidence"), and the Gate 2 card.

### H2-html-1-29 [codebase-details] Severity: Major
* Target: lines 189, 381 (M8)
* Finding: The deploy workflow has six jobs (audit, evidence, build, attest, deploy, smoke); the page shows "deploy → smoke test".
* Decision: CONTEST
* Reason: The node sits after Gate 2. In `deploy-production-release.yml` the `production` environment pause is on the `deploy` job (lines 202-209) and `smoke` needs `deploy` (line 323), so "deploy → smoke test" is the true order after the gate. `docs/ops/gate2.md` owns the full job list and the banner now points there.
* Edit: none

### H2-html-1-30 [codebase-details] Severity: Nit
* Target: N1-N6
* Finding: Required reviewers and required checks live in GitHub settings; four "Watch" metrics have no collector; stats and footer still say three actors.
* Decision: PROPOSE FIX for the metrics caption; DECLINE for the rest
* Reason: The caption now says nothing collects the metrics. The stats and footer describe the design.
* Edit: Learning-loop caption.

### H2-html-1-31 [style] Severity: Major
* Target: P2, P4, P6
* Finding: "Two approvals" undercounts; "Gate 2" covers two environments; "three build cycles still live" does not map to the milestones.
* Decision: PROPOSE FIX
* Reason: Settled by the rewrites in 1-21, 1-23, and 1-28: the count sentence is gone, the heading says "wait for a human", and the banner lists what is live.
* Edit: as above

### H2-html-1-32 [style] Severity: Major
* Target: P3, P5, P7, P8 (rest), P9, P10, P11
* Finding: "gate" names three things; the matrix heading says "exactly one kind of power"; the "How it was built" heading durations do not match the dates; unclear referents in the learning-loop panel; one versus two vulnerabilities; "unattended" versus the human merge of PR #433; the night-shift fix path described three ways.
* Decision: ESCALATE
* Reason: These are the owner's essay framing and historical narrative. The code cannot settle who merged PR #433 or what the July design intended. Redrawing the delivery diagram, the state machine, the night-shift diagram, and the matrix cells to show today's pipeline also belongs here.
* Edit: none

## Findings: docs/codebase-analysis-report.html (banner only)

### H2-html-1-33 [codebase-details] Severity: Major
* Target: report lines 13-120
* Finding: Six findings are fixed in code (SEC-01, ERR-01, OBS-01, TEST-02, ARC-02, CNTR-01) and DOC-01's listed drift is corrected. CFG-01 is still present at `lib/sync/sync-status-store.ts:200`. Sentry is gone (ADR 0017). App version is 14.8.7, IndexedDB version 17, 46 e2e spec files, CI runs the full suite on the static export (`ci.yml:164-172`), root Vitest is 5.0.5.
* Decision: PROPOSE FIX (banner only)
* Reason: I confirmed each item in the code: `lib/tasks/crud/create.ts:53,58-60`, `update.ts:37`, `lib/logger.ts:131,149`, `lib/sync/sync-status-store.ts:259-266`, `lib/tasks/import-export.ts:201-204`, `tests/data/service-worker-privacy.test.ts:178-184`, `lib/sync/health-monitor.ts:1-7`, `lib/task-card-memo.ts`, `package.json:3,92,95`.
* Edit: One `<div class="callout">` inserted after `<main class="wrap">`, using the file's own class. No other change.
