# Session state — 2026-09-04 (PR #527 blocking-defect fixes)

Branch: `fix/pr527-blocking-defects`, cut from `fix/security-review-2026-09-04`
@ `b2d597c`. These are defects **in** that PR, found by reviewing it before merge.

## Review that produced this list

10-dimension review with three-lens adversarial refutation: 35 findings raised,
16 survived (12 unique after dedup), 19 refuted. The critical one was confirmed
against production with a read-only probe.

## Fixed here

- [x] **Night-shift discovery reported a broken helper as "no work"** —
      `node "$HELPER" || echo 0` turned any execution failure into `NO_WORK`.
      Same gap made CI red: the test pinned PATH to `/usr/bin:/bin` but Linux
      runners keep node in `/usr/local/bin`. Now reports `UNKNOWN`. (`63adaea`)
- [x] **Rollback aborted mid-deploy** — the new unconditional
      `aws s3 cp out/theme-init.js` fails for any tag before v12, after both
      `--delete` syncs and before the CloudFront invalidation. (`12e31d4`)
- [x] **Encryption verification harnesses broken by the owner hook** — both
      created their probe task with a synthetic owner, which
      `account_lifecycle.pb.js` rejects. Verified against a real PocketBase,
      with a control run proving causation. (`004c0a3`)
- [x] **Legacy TLS config silently ignored** — a bare `TLS_CERT`/`TLS_KEY` pair
      fell back to Caddy's private CA. Also fixed the compose file's Let's
      Encrypt example, which needs `TLS_MODE=public`. (`649bca7`)

- [x] **CRITICAL — account deletion was broken in production.** The client only
      called `DELETE /api/gsd/account`, which lives in `docker/pb_hooks/` and is
      **not loaded on api.vinny.io**: verified live, the route 404s identically
      to a nonexistent one, and the repo's own privacy doc confirms task content
      is plaintext, so the sibling encryption hook is absent too. The
      transactional route stays preferred; a 404, and only a 404, falls through
      to client-side erasure. (`2dd8802`)
- [x] **Export wrote backups this build refused to restore** — smart views were
      the only store emitted unvalidated while import hard-failed on them. Shape
      and count bounds now clip and count; resource bounds still fail closed.
      Also fixed the tag cap, which reused the per-task limit. (`0dcdeca`)
- [x] **MCP server died silently at startup** — a network round-trip inside a
      bare `catch { process.exit(1) }`, with the token file left on disk.
      Startup is offline-only now, and reachability no longer retires a
      token. (`0f14206`)
- [x] **Failed queue items pinned tasks forever** — reverted the #440 fix for a
      Confirmed Medium in `docs/audits/AUDIT-2026-07-10.md`. Both guards share
      one classifier; a released task goes to Trash rather than being
      dropped. (`c837b9a`)

## Verification

Full suite 2996 passing, typecheck, lint, and the code-shape ratchet all green.
The cross-platform fixture pair still round-trips, so the iOS backup contract
is intact. The local encryption harness was run against a real PocketBase with
the hooks loaded, with a control run proving the owner hook was the cause.

## Resuming From Here

Still open, and none of it is code on this branch:

- The audit's second half: a failed queue row for a task that still exists
  remotely is still terminal, with no retry or dismiss surface. Recorded in the
  audit's status line rather than silently closed.
- `packages/mcp-server/package.json` is still 1.2.5. The docs now pin users to
  that published version, which predates every MCP fix here, so a release is
  needed before those docs are true.
- The operational items below, none of which this branch can do.

## Not code defects, still required before merging #527

- `gh workflow disable deploy-prod.yml` (id 279641929) — still active.
- `production` environment has no deployment branch policy; `cloudfront-infra`
  has no required reviewer.
- Deploy the two new pb_hooks **before** the web deploy, or account deletion
  ships broken. Do not run the new feedback setup script first: it nulls
  `createRule`, then verifies the hook, then exits on the 404, which would
  disable the working feedback form.
- `packages/mcp-server/package.json` is still 1.2.5, the published version that
  predates every MCP fix here, and the docs now pin users to it.

---

# Session state — 2026-09-04 (21-finding security remediation)

Branch: `fix/security-review-2026-09-04` · Source: sealed scan
`7a618980-51cd-4b14-8241-4020dd8a7e58` at `e7ae02d7`.

## Plan

- [x] Read security skill, repository policy, current sources, callers, and tests.
- [x] Run eight independent read-only pre-patch investigations and reconcile scope.
- [ ] RED/GREEN local lifecycle, account-switch, delete-dialog, import, telemetry,
      verifier, cache, TLS, and feedback-control fixes.
- [ ] RED/GREEN browser sync completeness/version/conflict/cardinality fixes plus
      server-side account-deletion hooks.
- [ ] RED/GREEN MCP principal, executable pinning, token display, and bounded reads.
- [ ] RED/GREEN builder/night-shift attestation and fail-closed execution changes.
- [ ] RED/GREEN deployment/publishing job privilege separation and protected dispatch.
- [ ] Focused verification and atomic commits by boundary; never stage `bun.lock`.
- [ ] One fresh bypass/regression reviewer; address one review cycle.
- [ ] Full project/MCP/PocketBase/security gates and final fix report.

## Decisions

- Use the existing 10,000-task import ceiling for browser/MCP account-wide reads;
  overflow is an explicit error, never silent truncation.
- Retire unattended local PR code execution until a real ephemeral,
  credential-free runner exists; exact-SHA attested discovery remains diagnostic.
- Default anonymous feedback creation to denied. Public creation becomes an
  explicit final setup step only after the provisioned controls verify.
- Keep remote account cleanup client-compatible, but make checked-in server hooks
  the authoritative no-orphan boundary for the supported deployment.

---

# Session state — 2026-09-02 (resume: merge #525, release v12.7.0, audit fix)

Branch: `fix/deps-browserslist-advisory` (off `main` @ af0bbff). Local commits only, not pushed.

## Done this session

- [x] PR #525 squash-merged as `af0bbff` (`gh pr merge --admin`; owner PR, code-owner gate).
      Local `feat/feedback-nudge` deleted after GitHub confirmed the merged head matched the
      local tip. The remote branch still exists (deleting it is externally visible; left alone).
- [x] Prod already served the release before the merge: `sw.js` 12.7.1 = package.json 12.7.0
      + 1, deployed from this machine at 06:38 local; a served chunk contains
      `nudge-dismissed`. The local `sw.js` at 12.7.1 was that build's artifact; reverted.
- [x] Local tag `v12.7.0` → af0bbff. **Tag push and GitHub release were blocked by the
      auto-mode classifier.** Owner runs:
      `git push origin v12.7.0 && gh release create v12.7.0 --generate-notes --title "v12.7.0"`
- [x] Security Audit went red on `main` at 07:01 today with no commit behind it (not #525):
      browserslist ≤4.28.6, GHSA-c83g-rgw3-j3cx + GHSA-73wf-gq98-2v4g, fixed in 4.28.7.
      Fixed test-first: guard-test pin (red) → `overrides.browserslist: ">=4.28.7"` →
      `bun install` (green; lock → 4.28.8, bun also pruned dangling entries and fixed the stale
      mcp-server 1.2.4 workspace entry). Gates: 2946 tests, typecheck, lint, quality:shape,
      build, `bun audit`, `bun install --frozen-lockfile` (no changes).
- [x] Codex P2 on #525 (archived completions are not counted by the nudge): mechanics are
      accurate, the effect is fail-closed, auto-archive is off by default, and the 08-27
      deviation note already covers it. Not replied to (PR comments need the owner's OK).
- [x] `tasks/implementation-notes.md` (08-27 ledger) distilled into `tasks/lessons.md` and
      deleted.

## Resuming From Here

- Next, on the owner's go-ahead: push `fix/deps-browserslist-advisory`, open the PR, watch the
  **Security Audit** workflow (separate from CI) go green, `gh pr merge --admin`, clean up the
  branch. Then push the tag and create the release (command above).
- The owner's uncommitted `bun.lock` churn (a `bun update`-style refresh: babel, browserbase,
  csstools…) was set aside, not committed. Backup:
  `/private/tmp/claude-501/-Users-vinnycarpenter-Projects-GSD-gsd-taskmanager/661980b8-7522-4901-be12-764c5fbafbdc/scratchpad/bun.lock.local-churn`
  — reproducible with `bun update` if wanted.
- Possible follow-up from the Codex comment: count `archivedTasks` in `summarizeEngagement`
  for users who archive aggressively. Nicety, not a bug.
- Carried: `components/settings/about-section.tsx:11` still falls back to `"6.1.1"`; PB rate
  limit + log retention manual steps; roadmap slug curation; privacy policy on
  gsdtaskmanager.com.
- Pre-existing red on this machine only: `dependency-license-policy`
  (`@img/sharp-libvips-darwin-arm64` LGPL in the local install).

---

# Session state — 2026-09-02 (feedback nudge on the Review page)

Branch: `feat/feedback-nudge` (web only; iOS deliberately not mirrored — owner decision 2026-09-02).
Design approved in chat (bounded path): one dismissible sentence on the Review page, shown only
once the user's own task data proves they are a returning user. No toast, no modal, no badge.

## Plan

- [x] 1. RED/GREEN `lib/feedback/nudge-eligibility.ts` — pure: `summarizeEngagement(tasks, now)`
      and `shouldShowFeedbackNudge({...})`. Thresholds: tenure ≥14d, completions ≥10,
      distinct completion days ≥3; suppress if sent <90d, dismissed <180d, or a draft exists.
- [x] 2. RED/GREEN `lib/feedback/feedback-store.ts` — `gsd:feedback:nudge-dismissed` key,
      `readNudgeDismissedAt` / `recordNudgeDismissed`, exposed on the snapshot.
- [x] 3. RED/GREEN `components/dashboard/feedback-nudge.tsx` — reads the store via
      `useSyncExternalStore`, renders null unless eligible; link → `/settings#feedback`, "Not now".
- [x] 4. Wire into `app/(dashboard)/dashboard/page.tsx` under the stat rail (header block).
- [x] 5. Passive links: help drawer Privacy section + app footer → `/settings#feedback`.
- [x] 6. `bun run test` · `bun typecheck` · `bun lint` · `bun run quality:shape`.
- [x] 7. `/verify-frontend-change` PASS. Chrome (real clicks, SW busted before each trusted
      reload): dark + light render, link opens Settings → Feedback, "Not now" hides the line,
      writes `gsd:feedback:nudge-dismissed`, moves focus to `#main-content`, stays hidden after
      reload; footer + help-drawer links present; console clean. Headless Playwright at 390px:
      no horizontal overflow, link/button 44px on coarse pointer. Dev data restored afterwards.
- [x] 8. a11y-reviewer pass on the new component — 3 blocking findings, all fixed test-first:
      at-rest underline on the text controls (WCAG 1.4.1), focus hand-off to `#main-content`
      before the dismiss button unmounts, `div` wrapper instead of `p`.
- [x] 9. Committed on `feat/feedback-nudge`; spec note added. Push/PR awaiting the owner's
      go-ahead (CLAUDE.md: pushing needs confirmation).

## Deviations from the approved design (tactical, logged)

- Archive table not consulted: completed tasks stay in `tasks` for 30 days by default
  (`ARCHIVE_CONFIG.DEFAULT_ARCHIVE_AFTER_DAYS`), which covers the 14-day tenure window.
- Onboarding-seen check dropped: tenure ≥14d + ≥10 completions already excludes first-timers.
- No "same session" suppression: meaningless for an inline line (it is not a popup).
- Version bump deferred: the working tree carries an uncommitted, internally inconsistent bump
  (package.json 12.6.5 vs sw.js 12.6.6, README 12.5.0). Not this branch's to overwrite.

## Release + PR (owner request 2026-09-02)

- [x] Bump the pinned trio to 12.7.0 (package.json, README:7, sw.js CACHE_VERSION); prod was 12.6.5.
- [x] Bump committed, branch pushed, PR #525 open: https://github.com/vscarpenter/gsd-task-manager/pull/525

## Resuming From Here

- Done: nudge-eligibility module, store dismissal state, `FeedbackNudge` on the Review page,
  help-drawer + footer links, a11y fixes, 24 new tests; all gates green (test / typecheck /
  lint / quality:shape). Live-app verification PASS (details in step 7).
- Next: watch CI on PR #525, merge with `gh pr merge --admin` (owner PR, code-owner gate),
  then `bun run deploy` and tag. `bun.lock` still carries unrelated local churn (mcp-server
  1.2.4 → 1.2.5 plus dep re-serialization); decide separately whether to commit it.
- Pre-existing red on this machine, not this branch: `documentation-currentness` (README
  12.5.0 vs uncommitted package.json 12.6.5) and `dependency-license-policy`
  (`@img/sharp-libvips-darwin-arm64@1.3.3` LGPL in the local install).
- Assumption: iOS deliberately does not mirror the nudge (owner decision 2026-09-02).

---

# Session state — 2026-08-28 (path move + parity shipping + merges)

## Resuming From Here

Merged (all squash):
- web #520 backup interop + Apple sign-in + reminders + import-cap fix → 65f15b6
- iOS #10 full-fidelity backups + trash (merged from GitHub UI by Vinny)
- web #521 retire half-wired plumbing + docs truth → e332f5b
- web #522 sound + quiet-hours controls → e8d793a
- Post-merge main verified green: 2877 tests, typecheck, shape ratchet.

CI notes for next time:
- The pre-push gate must include `bun run quality:shape` — the CI lint job runs
  it and it is a required check. Both #520 and #522 needed shape-fix commits.
- Repo ruleset requires code-owner review, which the owner can't self-satisfy;
  owner PRs merge with `gh pr merge --admin`.
- SonarCloud (new-code coverage 80%) is advisory, not required.

Still open:
- Unpushed path-fix branches: web chore/gsd-workspace-paths (2 commits),
  iOS chore/gsd-workspace-paths (1 commit), usage repo main (local-only).
  Until the web one lands, main's builder-run.sh SOURCE default still names
  the old path (installed launchd plists already fixed).
- iOS import cap still counts tasks only — needs its own iOS change.
- User to run: claude mcp add --scope local --transport http sentry https://mcp.sentry.dev/mcp
- Claude Desktop config still lists old workspace paths (edit after quitting app).
- Other sessions' iOS branches fix/capture-parser-parity + fix/reminder-options-parity
  merged as #11/#12; their local branches remain (not this session's to clean).

## Carried from 2026-08-27 (anonymous feedback, shipped as #516)

The prior status file tracked feat/anonymous-feedback; it merged as PR #516,
so its "push and PR" item is done, and the prod `feedback` collection now
responds (a bare POST returns 400, not 404) — the setup script appears to have
run. Still possibly open, per that file:
- The two manual steps the setup script prints: rate limiting and log
  retention on api.vinny.io.
- Curate `lib/feedback/roadmap-items.ts` — the eight candidates were a seed.
- Update the privacy policy at gsdtaskmanager.com/privacy (separate repo).
- Deferred by design: the earned-moment feedback prompt after N completions.
