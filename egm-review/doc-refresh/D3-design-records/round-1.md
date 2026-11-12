# Doc refresh: D3-design-records, round 1

Status: resolved
Clean round: no

All targets are under `docs/superpowers/specs/`. All are mode NOTE. The batch question was narrow: did the design ship, was it removed or superseded, and does it send a reader to something that no longer exists. Findings that only report drifted lines are grouped and declined as outside that question. The resolver opened the cited code and `git log` before writing each note.

## Reviewer status
| Reviewer | Target | Status |
|---|---|---|
| egm-codebase-details A | close-analysis, mcp-sentry, server-side-encryption | ran |
| egm-codebase-details B | native-ios-app | ran |
| egm-codebase-details C | the-contract, builder-gate1, night-shift | ran |
| egm-codebase-details D | review-gate2, telemetry, tokens-per-pr, stagehand | ran |

## Findings

### D3-design-records-1-1 [codebase-details A] Severity: Blocker
* Target: 2026-05-25-close-analysis-open-items-design.md lines 118-176
* Finding: PR 3 (Sentry) reads as approved work. `lib/sentry.ts` is absent, and ADR 0017 removed Sentry. `git show d969e745` (PR #566) deletes `lib/sentry.ts` and adds the ADR.
* Decision: PROPOSE FIX
* Reason: Confirmed. PR 1 and PR 2 remain (`safeParse` at `lib/tasks/crud/update.ts:63`, `lib/notifications/settings.ts:36,72`; `GlobalErrorListener` at `app/layout.tsx:227`).
* Edit: status note added under the title.

### D3-design-records-1-2 [codebase-details A] Severity: Major
* Target: same file, lines 75, 82-83, 98
* Finding: the shipped listener does not log and does not call `preventDefault()` (`components/global-error-listener.tsx:12-18`).
* Decision: PROPOSE FIX
* Reason: Confirmed by reading the component. One sentence in the note covers it.
* Edit: covered by the same note ("shows the throttled toast and does not log").

### D3-design-records-1-3 [codebase-details A] Severity: Major
* Target: same file, line 153
* Finding: `connect-src` no longer allows `https:` (`app/layout.tsx:52-57`).
* Decision: DECLINE
* Reason: The claim only served the removed Sentry work, which the note already marks as removed. Outside the batch question.
* Edit: none

### D3-design-records-1-4 [codebase-details A] Severity: Nit
* Target: same file, lines 11, 36-38, 87, 124-125
* Finding: line references have drifted.
* Decision: DECLINE
* Reason: Drifted line numbers in a dated record.
* Edit: none

### D3-design-records-1-5 [codebase-details A] Severity: Blocker
* Target: 2026-05-29-mcp-server-sentry-coverage-design.md, whole file
* Finding: nothing it describes exists. `packages/mcp-server/src/utils/sentry.ts` is absent, and `packages/mcp-server/CHANGELOG.md` (1.3.0) records the removal of `@sentry/node` and `GSD_SENTRY_DSN`.
* Decision: PROPOSE FIX
* Reason: Confirmed in the changelog, the directory listing, and `git show d969e745`.
* Edit: status note added under the title.

### D3-design-records-1-6 [codebase-details A] Severity: Blocker
* Target: 2026-06-20-server-side-encryption-design.md lines 4, 10, 88, 96-98, 136
* Finding: the record reads as if encryption covers the hosted service. ADR 0016 says the hosted service runs without the hooks or the key.
* Decision: PROPOSE FIX
* Reason: Confirmed in `docs/adr/0016-hosted-sync-defers-field-encryption.md`, `docker/pb_hooks/encryption-core.js:6-8`, and `docker/docker-entrypoint.sh:4-9`. The note attributes the hosted state to the ADR, because the repo cannot prove the live server.
* Edit: status note added under the title.

### D3-design-records-1-7 [codebase-details A] Severity: Major
* Target: same file, line 22
* Finding: PocketBase is pinned at 0.40.4, not 0.26.6 (`docker/Dockerfile:47`).
* Decision: PROPOSE FIX
* Reason: Confirmed.
* Edit: one sentence in the same note.

### D3-design-records-1-8 [codebase-details A] Severity: Major
* Target: same file, lines 66-67, 86, 92, 102, 119, 120, 140
* Finding: four drift items: the About copy was not applied, empty JSON arrays are encrypted, idempotency checks more than the prefix, and the migration invocation differs.
* Decision: DECLINE
* Reason: Implementation drift inside a design that still shipped. The note points at the later migrations in `docker/pb_migrations/` and at ADR 0016. Not verified line by line by the resolver.
* Edit: none

### D3-design-records-1-9 [codebase-details B] Severity: Major
* Target: 2026-05-30-native-ios-app-design.md lines 4, 8, 48-53
* Finding: status says "Draft for review", but this repo shows the native app shipped (`README.md:77-79`). No later document is named as successor.
* Decision: PROPOSE FIX
* Reason: Confirmed in `README.md`. The note says only what this repo shows.
* Edit: status note added under the title.

### D3-design-records-1-10 [codebase-details B] Severity: Blocker
* Target: same file, §5.10, §6.16, §7.1 (lines 247-251, 460-468, 502-534)
* Finding: the web code has added `saved_at`, `focus_date`, `focus_rank` (`lib/sync/task-mapper.ts:61-63`), a wider backup envelope at version 2.2.0 (`lib/tasks/import-export.ts:24,190-195`), a `deletedTasks` store and schema v17 (`lib/db-migrations.ts:235-236`).
* Decision: PROPOSE FIX
* Reason: Confirmed each in code. The note groups them and names ADRs 0014, 0015, 0018, 0019, and 0020.
* Edit: covered by the same note.

### D3-design-records-1-11 [codebase-details B] Severity: Blocker
* Target: same file, lines 162, 529, 539, 782
* Finding: the spec gives a lossy `{id, startedAt, minutes}` wire shape for time entries. The web pushes `task.timeEntries` unchanged (`lib/sync/task-mapper.ts:151`).
* Decision: ESCALATE
* Reason: The resolver confirmed the web side. The spec's shape may describe what the iOS client does, and that code is out of reach. The note tells the reader not to use the spec as the shared contract.
* Edit: none beyond the general warning.

### D3-design-records-1-12 [codebase-details B] Severity: Major
* Target: same file, auth, pull, push, MCP, Sentry, preferences (M1 to M9 in the reviewer report)
* Finding: Apple sign-in was added (`lib/sync/pb-auth.ts:21`), a pull contract version exists (`lib/constants/sync.ts:64`), Sentry is gone (ADR 0017), and several smaller items drifted.
* Decision: PROPOSE FIX for Apple sign-in, the pull contract version, and Sentry. DECLINE for the rest.
* Reason: The three confirmed items fit the note. The others are line drift in a record the note already marks as not current.
* Edit: covered by the same note.

### D3-design-records-1-13 [codebase-details C] Severity: Blocker
* Target: 2026-07-07-the-contract-design.md lines 26, 33
* Finding: `deploy-dev.yml` and `deploy-prod.yml` do not exist. The `production` gate is at `.github/workflows/deploy-production-release.yml:207-208`.
* Decision: PROPOSE FIX
* Reason: Confirmed. `git log --diff-filter=D` shows `deploy-prod.yml` deleted by PR #527 and `deploy-dev.yml` by PR #540.
* Edit: status note added under the title.

### D3-design-records-1-14 [codebase-details C] Severity: Major
* Target: same file, lines 10, 45, 114-119
* Finding: nothing consumes the risk tier today. The design's own files all exist and match.
* Decision: PROPOSE FIX
* Reason: Confirmed: `docs/agents/builder.md` is a retirement notice, and the template, workflow, script, and PR template exist.
* Edit: covered by the same note.

### D3-design-records-1-15 [codebase-details C] Severity: Nit
* Target: same file, lines 67, 94
* Finding: the dropdown has no leading non-answer option, and the workflow also runs `actions/checkout`.
* Decision: DECLINE
* Reason: Small drift.
* Edit: none

### D3-design-records-1-16 [codebase-details C] Severity: Blocker
* Target: 2026-07-07-builder-gate1-design.md lines 35, 47-53, 68-92, 107, 111
* Finding: the builder is retired. `scripts/builder-run.sh` prints a disabled notice, `.claude/commands/build-next.md` refuses to run, and `docs/agents/builder.md` holds no operating spec. The reviewer found no PR number.
* Decision: PROPOSE FIX
* Reason: Confirmed in all three files. `git show dbc968b5` (PR #527) is the commit that rewrote them. PR #424 added them.
* Edit: status note added under the title.

### D3-design-records-1-17 [codebase-details C] Severity: Major
* Target: same file, lines 29, 64, 71, 100-102, 115
* Finding: `builder:paused` is no longer read, the plist now runs the tombstone, and the ruleset claim could not be checked.
* Decision: PROPOSE FIX for the labels. DECLINE for the plist and ruleset.
* Reason: `rg` finds the labels only in `scripts/setup-labels.sh`, docs, and an unused helper. The ruleset is live GitHub state.
* Edit: one sentence in the same note.

### D3-design-records-1-18 [codebase-details C] Severity: Blocker
* Target: 2026-07-08-night-shift-design.md lines 10, 32, 46-70
* Finding: the fix loop is retired. `scripts/triage-run.sh` does discovery only behind `GSD_TRIAGE_BOT_LOGIN`, `.claude/commands/triage-prs.md` refuses to run, and `docs/agents/night-shift.md` holds no policy table.
* Decision: PROPOSE FIX
* Reason: Confirmed in all three files. `git show dbc968b5` (PR #527) removed the worktree and the `claude -p "/triage-prs"` call. PR #427 added the design.
* Edit: status note added under the title.

### D3-design-records-1-19 [codebase-details C] Severity: Major
* Target: same file, lines 28, 39-42, 49, 76-78
* Finding: `failingAgentPRs` now takes a bot login and checks provenance, no self-audit comment is posted, and the kill switch only stops discovery.
* Decision: DECLINE
* Reason: Detail below the level of the note, which sends the reader to `docs/agents/night-shift.md` for current behavior.
* Edit: none

### D3-design-records-1-20 [codebase-details D] Severity: Blocker
* Target: 2026-07-08-review-gate2-design.md lines 6, 12, 17-19, 25, 33-34, 43, 51-74, 78, 83-90
* Finding: `deploy-prod.yml`, `deploy-dev.yml`, `release-ready.yml`, and the `release-ready` label are gone. The rollback command targets a missing workflow. The current rollback is a repository dispatch (`docs/ops/gate2.md:48-56`).
* Decision: PROPOSE FIX
* Reason: Confirmed. PR #449 (`e4d441d7`) deleted `release-ready.yml` and the label line. PR #527 added `deploy-production-release.yml`. PR #540 deleted `deploy-dev.yml`. PR #426 added the design.
* Edit: status note added under the title.

### D3-design-records-1-21 [codebase-details D] Severity: Major
* Target: same file, lines 49, 55, 56
* Finding: the workflow computes the previous tag in shell (`deploy-production-release.yml:86-90`) and does not call `scripts/prev-release-tag.cjs`. The evidence fields differ.
* Decision: PROPOSE FIX for the shell computation. DECLINE for the field list.
* Reason: Confirmed by `rg`: no workflow references the script.
* Edit: one clause in the same note.

### D3-design-records-1-22 [codebase-details D] Severity: Major
* Target: same file, lines 12, 32
* Finding: `.github/workflows/claude-code-review.yml` exists, while `docs/pipeline-summary.html` says the reviewer was retired on 2026-07-23.
* Decision: ESCALATE
* Reason: `git log` shows PR #449 deleted the workflow and PR #565 added one back. Whether it gates anything is live GitHub state. The note makes no claim about the reviewer.
* Edit: none

### D3-design-records-1-23 [codebase-details D] Severity: Blocker
* Target: 2026-07-08-telemetry-design.md lines 16, 31, 52-62, 71-73, 78, 83
* Finding: `.github/workflows/telemetry.yml` does not exist, and `computeMetrics` has no caller outside its test.
* Decision: PROPOSE FIX
* Reason: Confirmed. PR #449 deleted the workflow. PR #429 added the design. `docs/ops/pipeline-audit.md:17` says the workflow is retired.
* Edit: status note added under the title.

### D3-design-records-1-24 [codebase-details D] Severity: Major
* Target: same file, lines 6, 21, 47, 66-69
* Finding: `tokensPerPR` is no longer null, `openwiki-freshness.yml` is gone, and the audit doc no longer uses telemetry.
* Decision: PROPOSE FIX for the audit doc. DECLINE for the rest.
* Reason: The tokens record covers `tokensPerPR`. The OpenWiki workflow was a pattern reference only.
* Edit: one sentence in the same note.

### D3-design-records-1-25 [codebase-details D] Severity: Blocker
* Target: 2026-07-08-tokens-per-pr-design.md lines 6, 30-40, 50
* Finding: the producer (`scripts/builder-run.sh`, `.claude/commands/build-next.md`) and the consumer (`telemetry.yml`) are gone. The two helpers remain with no caller.
* Decision: PROPOSE FIX
* Reason: Confirmed. The pre-#527 `builder-run.sh` and the pre-#449 `telemetry.yml` both held the `gsd-tokens` marker, so the design did ship.
* Edit: status note added under the title.

### D3-design-records-1-26 [codebase-details D] Severity: Major
* Target: 2026-08-11-stagehand-verification-design.md lines 69, 92, 138
* Finding: the exit code is also 1 on page errors and failed requests (`tools/stagehand/report.ts:51-61,88-91`).
* Decision: DECLINE
* Reason: Confirmed in code, but the design shipped and still describes `tools/stagehand/`. The batch rule is to add nothing in that case. The stricter exit code does not send a reader to anything missing.
* Edit: none

### D3-design-records-1-27 [codebase-details D] Severity: Nit
* Target: same file, lines 20-24, 51-57, 79, 84, 111, 135-138
* Finding: 10 small drift items (exact dependency pin, zod version, extra seed scenarios, renamed functions).
* Decision: DECLINE
* Reason: Small drift in a design that still describes the code.
* Edit: none
