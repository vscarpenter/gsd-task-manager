# GSD Task Manager — Task Tracker

---

## Done — 2026-08-12: Review remediation, Waves F & G (v11.6.1 → v11.10.1)

Spec: `tasks/spec-review-remediation-wave-a-b.md`. **Every wave the user selected is
now shipped.**

**Wave F**
- [x] #486 `fix(palette)` — quadrant badges named properly (`NUNI` → `Eliminate`);
      export actually exports, import lands on `/settings#data`
- [x] #487 `feat(matrix)` — completed tasks collapsed behind a per-quadrant "N done"
      disclosure; completed titles dim as well as strike
- [x] #488 `fix(task-card)` — drag grip no longer covers the title's first character

**Wave G**
- [x] #489 `refactor(edit-drawer)` — the hard gate: form split into field groups
- [x] #490 `feat` — recurrence authoring
- [x] #491 `feat` — subtasks authoring
- [x] #492 `feat` — estimate input
- [x] #493 `feat` — Wave A's withheld surfaces restored

### Findings worth keeping

- **Two of three layout claims did not reproduce.** The mobile capture bar clears the
  last card, and the Share dialog's actions are on screen at 720px. Both are kept as
  measured regression guards in `tests/e2e/layout-overlap.spec.ts` rather than removed.
- **jsdom has no layout**, so overlap defects are invisible to the unit suite by
  construction. They need real bounding boxes at a real viewport.
- **The estimate is stored as a string** in draft state so an emptied field means "no
  estimate" rather than `0` — a zero would drag Review's Estimation Accuracy down for
  every unestimated task.
- The `e2e-quality-gates` test bans fixed `waitForTimeout` sleeps; use
  `scrollIntoViewIfNeeded` or an assertion instead.

### Resuming From Here

- **Done:** Waves A–G complete. Suite at 2736 passed. Dexie v16, backup envelope 2.1.0.
- **Next:** nothing outstanding from the user's selections. Unselected items from
  `docs/audits/ACTION-CHECKLIST-2026-08-12.md` remain available — search/tag ergonomics (Phase 2), backup nudge
  and copy-diagnostics (Phase 3), due times / per-task reminders (Phase 4), and all of
  Phases 5–7.
- **Blockers:** none.
- **Carried follow-ups:**
  - Trash is per-device (never synced), same as the archive — ADR 0015.
  - A dedicated Trash page rather than a Settings section, if the list grows.
  - Keyboard drag cannot easily reach an *empty* quadrant.
  - `isTaskBlocking` in `lib/dependencies.ts` has no callers and keeps the unfiltered
    semantics that caused #473.
  - True offline testing (network severed) remains uncovered — deselected by the user.
  - `tests/ui/zz-dbg.test.tsx` is a scratch file with a deliberately-failing assertion;
    a hook blocks the agent from deleting it. **Remove it manually.**

---

## Done — 2026-08-12: Review remediation, Waves D & E (v11.4.1 → v11.6.0)

Spec: `tasks/spec-review-remediation-wave-a-b.md`. ADR: `docs/adr/0015-trash-with-retention.md`.

- [x] #480 `feat(matrix)` — complete-undo toast; `toggleCompleted` now returns
      `{ task, recurringInstance }` so undo can remove the spawned next instance
- [x] #481 `fix(logging)` — message moved into the console string argument; the
      prefix is built from *sanitized* metadata, and the pb-push leak guard now covers it
- [x] #482 `feat(matrix)` — filtered-empty state; header counts describe the visible set
- [x] #483 `fix(edit-drawer)` — dependency popup portalled out of the scroll container,
      arrow-key selection, scroll lock, backdrop-drag guard
- [x] #484 `feat(trash)` — soft-delete with 30-day retention (ADR 0015)

**Two things worth remembering:**

1. **Clipping is not stacking.** An absolutely-positioned descendant of an
   `overflow-auto` container is cut off at its edge; no z-index fixes it because the
   pixels are never painted. Portalling is the only fix. Once portalled, the popup has
   no positioned ancestor, so the anchor rect must be tracked — with `capture: true`,
   since the drawer's scroller does not bubble scroll to window.
2. **JSX `{/* */}` comments count as code** to the shape gate's `max-lines-per-function`
   (they are expression containers). `//` comments are skipped. This cost two ratchet
   failures before it was obvious.

### Resuming From Here

- **Done:** Waves A, B, C, D, E merged. Suite at 2714 passed. Dexie schema v16.
- **Next (user's remaining selections):**
  1. **Wave F** — command palette correctness (`UI`/`NUNI` badges + export/import
     actions that only open Settings), completed-task disclosure + strike/dim, layout
     fixes (mobile capture bar, Share modal fold, drag-handle clipping). ~2.5 days.
  2. **Wave G** — decompose `edit-drawer.tsx` **first** (hard gate), then recurrence,
     subtasks, estimate input; finally remove the Wave A "Coming soon" badges,
     restore the Recurring Tasks built-in view and the Help sentence.
- **Blockers:** none.
- **Carried follow-ups:**
  - Trash is per-device (never synced), same as the archive — recorded in ADR 0015.
  - A dedicated Trash page rather than a Settings section, if the list grows.
  - Keyboard drag cannot easily reach an *empty* quadrant.
  - `isTaskBlocking` in `lib/dependencies.ts` has no callers and keeps the unfiltered
    semantics that caused #473.
  - True offline testing (network severed) remains uncovered — deselected by the user.
  - `tests/ui/zz-dbg.test.tsx` is a scratch file with a deliberately-failing assertion;
    a hook blocks the agent from deleting it. **Remove it manually.**

---

## Done — 2026-08-12: Review remediation, Wave C (v11.4.0)

Spec: `tasks/spec-review-remediation-wave-a-b.md` (W-C1).
ADR: `docs/adr/0014-versioned-backup-envelope.md`.

- [x] #478 `feat(backup)` — envelope 2.0.0 carries all six user-owned stores; import
      accepts 1.0.0 and 2.0.0; device-local and account stores excluded by design

**The trap worth remembering:** `archivedAt` is declared in no schema and
`taskRecordSchema` is `.strict()`, so validating archived rows with it rejects every
one — *silently*, because the export path skips invalid records rather than throwing.
A naive implementation would have produced an empty archive indistinguishable from a
genuinely empty one. Recorded in `.claude/rules/archive-tombstone.md`.

### Resuming From Here

- **Done:** Waves A, B, C merged. Suite at 2669 passed; e2e 21/21 on data + settings.
- **Next (user's selections, in the approved order):**
  1. **Wave D** — Phase 1 leftovers: complete-undo toast (~2h), capture-friendly error
     serialization (~1h), filtered empty state + filter-aware header counts (~1 day),
     portal the Depends-on dropdown + popover audit + body-scroll lock (~1 day).
  2. **Wave E** — trash with 30-day retention (ADR 0015). Now unblocked: `deletedTasks`
     becomes another optional key in the 2.0.0 envelope, no second breaking bump.
  3. **Wave F** — command palette correctness, completed-task disclosure, layout fixes.
  4. **Wave G** — decompose `edit-drawer.tsx` **first** (hard gate), then recurrence,
     subtasks, estimate input, then remove the Wave A "Coming soon" badges.
- **Blockers:** none.
- **Carried follow-ups:**
  - Keyboard drag cannot easily reach an *empty* quadrant (`sortableKeyboardCoordinates`
    traverses registered droppables). Deserves its own issue.
  - `isTaskBlocking` in `lib/dependencies.ts` has no callers and keeps the unfiltered
    semantics that caused #473.
  - True offline testing (network severed) remains uncovered — deselected by the user.
  - `tests/ui/zz-dbg.test.tsx` is a scratch file with a deliberately-failing assertion;
    a hook blocks the agent from deleting it. **Remove it manually.**

---

## Done — 2026-08-12: Review remediation, Waves A & B (v11.3.1 → v11.3.4)

Spec: `tasks/spec-review-remediation-wave-a-b.md`. Source: `docs/audits/ACTION-CHECKLIST-2026-08-12.md`, derived
from an external review of deployed v11.2.1.

- [x] #473 `fix(deps)` — Blocking badge counts only open dependents (`getUncompletedBlockedTasks`)
- [x] #474 `fix(settings)` — storage figure includes archived; `useStorageSummary` extracted; seeder gained `gsdSeed.archived()` + `storage` scenario
- [x] #475 `fix(about)` — Recurring/Subtasks badged "Coming soon", Recurring smart view withheld, Help recurrence line removed
- [x] #476 `fix(dnd)` — drop targets resolve to quadrants instead of `over.id as QuadrantId`; `closestCorners`; a11y announcement gated on the write

**Seven checklist claims were verified false or stale** and deliberately not actioned —
see the "Rejected claims" table in the spec. Notably: the version misalignment was already
fixed, `Shift+N` is accurate, `TaskTimer` and the whole snooze UI are shipped, the badge did
*not* skew "Ready to Work", and the recurrence engine genuinely works.

### Resuming From Here

- **Done:** Waves A and B, all four PRs merged to `main`. Suite green at 2657 passed.
- **Next:** Wave C — versioned full-fidelity export/import (ADR 0014). This is the P0
  data-loss item: export reads only `db.tasks`, omitting `archivedTasks`, `smartViews`,
  `notificationSettings`, `archiveSettings`, `appPreferences`.
- **Order matters:** Wave C must land before Wave E (trash), so `deletedTasks` is an
  additive minor rather than a second breaking envelope bump.
- **Hard gate for Wave G:** `edit-drawer.tsx` must be decomposed *before* recurrence,
  subtasks, and estimate inputs are added. The shape ratchet's `max-lines` budget is 0
  and one-way.
- **Blockers:** none.
- **Open follow-ups:**
  - Keyboard drag cannot easily reach an *empty* quadrant — `sortableKeyboardCoordinates`
    navigates between registered droppables. Deserves its own issue.
  - `isTaskBlocking` in `lib/dependencies.ts` has no callers and retains the unfiltered
    semantics that caused #473. A future caller would reinstate the bug.
  - True offline testing (network severed) remains uncovered; the user deselected it.
  - When Wave G lands: remove the two About badges, restore the Recurring Tasks built-in
    view, restore the Help sentence, and revert the four tests asserting their absence.

---

## Done — 2026-08-11: Close two Medium audit findings and refresh report

- [x] OBS-01: Smoke reports now fail for console errors, page errors, and failed requests; focused regression coverage passed.
- [x] TEST-01: Added a serialized production-export PWA lifecycle gate for Chromium, Firefox, and WebKit, including service-worker control, cache-boundary checks, and an unavailable-origin reload.
- [x] Fixed the gate-discovered offline startup gap by precaching and classifying <code>/theme-init.js</code> as a runtime asset.
- [x] Regenerated <code>docs/codebase-analysis-report.html</code> with fresh root, production PWA, CSP, quality, and browser evidence. The latest canonical E2E sweep is recorded accurately as 269/270, with the isolated Chromium timeout retained as a Low follow-up.

---

## Done — 2026-08-11: Stagehand verification layer + live smoke tests (v11.3.0)

Branch `feat/stagehand-verification`. Spec: `docs/superpowers/specs/2026-08-11-stagehand-verification-design.md`; plan: `docs/superpowers/plans/2026-08-11-stagehand-verification.md`.

- [x] tools/stagehand/: harness (Haiku 4.5), verify.ts CLI, smoke.ts + 6 journeys, args/report modules
- [x] Page scripts moved to tools/stagehand/page-scripts/ + console-collector.js; SKILL.md updated (paths + runner rung)
- [x] Acceptance: verify true/false/--act runs green locally; smoke 6/6 local AND 6/6 vs https://gsd.vinny.dev; stopped-server failure path exits 1
- [x] Coverage 96%+ on deterministic modules; suite/typecheck/lint green; version 11.3.0

### Resuming From Here
- Done: all 9 plan tasks complete and committed on the branch.
- Next: change report + comprehension quiz, then push + PR on user go-ahead.
- Blockers: none. Assumptions: ANTHROPIC_API_KEY stays shell/env-provided (not in .env.local).

---

## Done — 2026-08-10: Resolve four Medium and fourteen Low audit findings

**Branch:** `codex/resolve-audit-findings` · **Tier:** Non-trivial ·
**Approved contract:** the user approved remediation of the exact findings from
the 2026-08-06 rescan; detailed contract in
`tasks/spec-audit-findings-remediation.md`.

**Plan (continuous diagnosis → TDD → implementation → rescan):**
- [x] Reverify every finding against current `main` and preserve inherited state.
- [x] Diagnose and regression-lock the Chromium E2E navigation race.
- [x] Resolve CI, documentation, typing, cycles, observability, dependency,
  license, CSP, and immutable-provenance findings.
- [x] Add live browser/PocketBase system coverage, targeted MCP write coverage,
  and safe bulk-write performance improvements.
- [x] Reduce and tighten the code-shape exception baseline.
- [x] Control the historical credential within the explicit authority boundary;
  deleting it from shared history remains a separately authorized rewrite.
- [x] Run specialist review, full verification, and refresh the canonical report.

**Verification:** root coverage passed 2,606 tests / 1 skip at 86.54/80.55/
86.97/87.66; MCP coverage passed 289 / 3 skips at 89.25/85.13/86.20/88.91,
with write operations at 99.25/95.20/100/99.71. Disposable PocketBase 0.39.10
and real 0.26.6-upgrade system paths passed 3/3. The 15-route production build,
strict-CSP Chromium boot, typecheck, MCP build, zero-warning lint, code-shape
ratchet, dependency/license/SBOM gates, current-source and full-history secret
scans, and diff checks passed. The affected browser set passed 42/42 across
Chromium, Firefox, and WebKit; the canonical full sweep completed 270/270.
Final WCAG and PocketBase/sync/MCP reviews returned 0 blocking findings and 0
suggestions. Three existing stashes remain preserved. SEC-04 remains one
controlled Medium manual gate because no shared-history rewrite or force-push
was authorized; all other 17 findings are closed.

---

## Done — 2026-08-05: Resolve rescan High and Medium findings

**Branch:** `codex/resolve-pre-rescan-issues` · **Tier:** Non-trivial ·
**Approved contract:** the user approved the current rescan's one High and eight
Medium findings; detailed contract in
`tasks/spec-rescan-high-medium-remediation.md`.

**Plan (continuous spec → TDD → implementation → verification):**
- [x] Resolve the current scan findings against repository evidence and record
  the approved contract, authority boundaries, edge cases, and test stubs.
- [x] Add red regression/quality tests for the build, security/PocketBase,
  hydration, E2E, MCP dispatcher, maintainability, and system-test gates.
- [x] Fix the fail-open build, add the secret-scan baseline/gate, and align
  repository PocketBase assets with production 0.39.10.
- [x] Fix deterministic hydration and replace Playwright fixed sleeps with
  state-based waits guarded by automatic browser-runtime error capture.
- [x] Replace the MCP switch with an exhaustive typed registry and enforce a
  per-file production code-shape ratchet.
- [x] Add and pass the disposable authenticated PocketBase system test.
- [x] Run required specialist reviews plus full root/MCP/build/E2E/security
  verification, make scoped logical commits, and leave inherited files intact.

**Authority boundary:** no Git-history rewrite or force-push is authorized. The
expired historical JWT remains a separately coordinated destructive cleanup;
this pass prevents recurrence and makes existing exceptions explicit without
committing matched secret content.

**Verification:** root coverage passed 2,561 tests / 1 skip at 88.41/82.14/
88.31/89.44; MCP coverage passed 225 / 2 skips at 84.64/77.42/86.39/84.82.
PocketBase fresh and real 0.26.6-to-0.39.10 upgrade scenarios passed 2/2,
including accented, CJK, emoji, owner isolation, timestamps, and encrypted disk
state. The final full Playwright run passed 269/270 across Chromium, Firefox,
and WebKit; its sole Firefox keyboard-dialog flake then passed 3/3 repetitions
(30/30 for that file), while every changed DnD path passed in the full run. A
prior full run in this pass passed 270/270. Typecheck, MCP build, the 15-route
production build, zero-warning lint, code-shape ratchet, shell syntax, full-
history Gitleaks (668 commits), `bun audit`, and diff checks passed. Final WCAG
and PocketBase/sync reviews returned 0 blocking findings and 0 suggestions.
The three inherited dirty files and three existing stashes were preserved.

---

## Done — 2026-08-05: Resolve pre-rescan issues 1–5

**Branch:** `codex/resolve-pre-rescan-issues` · **Tier:** Non-trivial ·
**Approved contract:** the user approved issues 1–5 from the pre-rescan review;
detailed contract in `tasks/spec-pre-rescan-hardening.md`.

**Plan (continuous TDD + immutable scan proof):**
- [x] Add red tests for MCP diagnostic redaction, task mutation error logging,
  composite form semantics, local-only completion animation, and deterministic
  repository tooling.
- [x] Implement the behavioral fixes without changing the visual design or
  exposing task content in diagnostics.
- [x] Pin Bun, replace dynamic audit execution, make lint warning-free, and
  repair the missing trust-boundary documentation references.
- [x] Run focused/full verification, browser interaction verification, and skeptical
  changed-file review.
- [x] Commit only intended remediation paths and prove that commit produces a
  clean scan worktree; preserve inherited files and existing stashes.

**Verification:** red produced 14 expected failures. Root coverage passed 2,544
tests / 1 skip at 88.86% statement, 82.51% branch, 88.69% function, and 89.88%
line coverage. MCP coverage passed 218/218 at 84.45/77.37/86.20/84.55.
Playwright passed 270/270 across Chromium, Firefox, and WebKit. Typecheck, MCP
build, 15-route production build, zero-warning lint, workflow YAML parsing,
`git diff --check`, and `bun audit` all passed. The scan target is the resulting
commit checked out in a clean detached worktree, not the inherited local tree.

**Preserved inherited state:** three stashes plus modified
`coding-standards.md`, `docs/codebase-analysis-report.html`, and `public/sw.js`.

---

## Done — 2026-08-05: Resolve the top five audit risks

**Branch:** `main` (uncommitted; no commit requested) · **Tier:** Non-trivial ·
**Approved contract:** the user asked to resolve the audit report's ranked top
five; detailed contract in `tasks/spec-top-five-audit-risks.md`.

**Plan (TDD + executable gate proof):**
- [x] Fix SEC-01 by parsing one captured Bun audit JSON document and failing
  closed on High/Critical findings or invalid evidence.
- [x] Fix TEST-01 by repairing deterministic Playwright isolation/fixtures and
  adding blocking Chromium CI with failure artifacts.
- [x] Fix TEST-02 by adding behavior coverage for MCP risk paths until its
  existing thresholds pass, then make that gate blocking in CI/Sonar.
- [x] Fix DEP-01 by removing the unused scanner, updating vulnerable
  transitive resolutions, and proving the installed graph audit-clean.
- [x] Fix CFG-01 by rejecting malformed remote client timestamps before LWW
  mapping, with mapper and pull regression tests.
- [x] Run focused and full tests, typecheck, lint, build as warranted, audit,
  Chromium E2E, and a skeptical changed-file review.

**Verification:** root suite 2,530 pass / 1 skip with 88.80% statement,
82.46% branch, 88.69% function, and 89.81% line coverage; MCP suite 216/216
with 86.01/78.26/91.17/86.21 coverage; Playwright 270/270 across Chromium,
Firefox, and WebKit. Typecheck, MCP build, 15-route production build, workflow
YAML parsing, and `bun audit` passed. Lint reported 0 errors and 12 inherited
or generated warnings. The security checker itself is 87.80% statement and
84.61% branch covered.

**Preserved inherited state:** three stashes plus modified
`coding-standards.md`, `docs/codebase-analysis-report.html`, and `public/sw.js`.

---

## Done — 2026-08-01: Date-anchored matrix intro briefing

**Branch:** `feat/matrix-intro-briefing` · **Tier:** Standard (content-only change
to the matrix intro block: one new pure module, two component wirings, test
updates; no new public contract). **Approved contract:** user-approved design in
this session (date-anchored briefing direction).

**Design summary:** replace the static hero copy ("Decide what deserves you." /
"Hold the whole picture…") with a date-anchored briefing. Eyebrow stays
"Today's matrix"; the h1 becomes the formatted local date with an sr-only
"Today's matrix — " prefix; the subtext becomes one computed sentence from a
priority-ordered rule set (empty board → overdue-located → overdue-scattered →
Q1-majority → all-clear). The subtext never mentions Q2 (the Protect Q2 card
owns that topic) and never repeats raw counts (the header pills own those).
Hydration: `dateLabel`/`stats` props are `null` until mounted/loaded and render
reserved blank space, keeping the static-export snapshot date-free.

**Plan (TDD):**
- [x] RED: unit tests for `intro-copy.ts` — `introDateLabel(now)` formatting and
  `introMessage(stats)` across all rules, boundaries, and pluralization.
  (16 tests; red confirmed via unresolved module import.)
- [x] GREEN: implement `components/matrix-simplified/intro-copy.ts`. (16/16.)
- [x] Wire `MatrixIntro` (dateLabel + message props, sr-only h1 prefix) and
  `index.tsx` (compute stats from `all`); update `app-shell.test.tsx` and
  `matrix-simplified.test.tsx` assertions, including the `renderToString`
  hydration-safety test (server snapshot asserted date-free).
- [x] Verify: full suite 2,513 pass / 1 skip; typecheck clean; lint 0 errors
  (10 known warnings). Coverage: intro-copy 100%, matrix-intro 100%, index.tsx
  90.9/86.8/85.7/92.5. Live browser (SW busted, console clean): all-clear,
  overdue-located, and overdue-scattered states each rendered the correct
  sentence; seeds cleaned up. Empty/Q1-majority states unit-covered only.
- [x] Version bump (11.0.1 → 11.1.0, package.json + sw.js CACHE_VERSION),
  commit `9e46145`, pushed, PR #468.

**Out of scope:** layout/spacing changes, the Protect Q2 card, design-lab
prototype copy (historical artifact), midnight rollover re-render, About-page
copy.

---

## Done — 2026-08-01: Clarify and strengthen Q2 shortcut feedback

**Branch:** `design/five-visual-directions` · **Tier:** Standard (bounded copy and
focus-state correction with no new navigation, persistence, or public contract).

**Plan (TDD + browser proof):**
- [x] RED: require truthful “Show Schedule” copy and an unmistakable persistent
  focus ring on the destination quadrant.
- [x] GREEN: update the Q2 cue and shared quadrant focus styling without changing
  the shortcut’s safe-context rules.
- [x] Verify focused tests and a cache-safe live Option+2 path in Chromium and
  WebKit, including console/runtime state.
- [x] Run the scoped WCAG-AA review, restore generated noise, and commit only the
  implementation, regression contract, and tracker update.

**Out of scope:** calendar/time-blocking features, shortcut activation while
typing or a dialog is open, service-worker changes, deploy, push, PR, or merge.

**Verification:** the original browser repro proved focus moved without any
rendered ring because the pane&rsquo;s inline card shadow overrode Tailwind&rsquo;s
ring shadow. The resting shadow now composes through the Tailwind shadow utility;
Chromium and WebKit both proved Option+1&ndash;4 changed DOM focus and the
rendered box shadow. Focused tests passed 62/62, the full suite passed 2,494
tests with 1 skipped, typecheck passed, and lint passed with 10 inherited
warnings. The 15-route production build passed and its generated CSS contains
both the composable card shadow and 4px focus-ring rules. The scoped WCAG-AA
review returned 0 findings. The inherited `public/sw.js` diff remains untouched.

---

## Done — 2026-08-01: Implement approved Refined Evolution hybrid

**Branch:** `design/five-visual-directions` · **Tier:** Non-trivial ·
**Approved contract:** user design decision plus `tasks/spec.md`.

**Plan (continuous spec -> implementation, TDD + browser proof):**
- [x] Re-run branch preflight and preserve inherited stashes/generated diffs.
- [x] Load project guidance, design skills, production architecture, prototypes,
  tests, and prior design decision evidence.
- [x] Map production seams for the shell/Q2 cue, mobile capture/editor,
  shortcuts, and Review language without importing prototype state.
- [x] RED: add regression contracts for shortcut safety/routing, Q2 truth/focus,
  mobile capture geometry, semantic headings, and Review copy.
- [x] GREEN: implement the matrix-owned Refined hierarchy and Q2 planning cue.
- [x] GREEN: implement safe-area mobile capture/editor behavior and touch fixes.
- [x] GREEN: implement the app-shell Option shortcut layer and Help discovery.
- [x] GREEN: reframe `/dashboard` as Review with metric-backed prompts.
- [x] Run Impeccable detector and WCAG-AA review; resolve every scoped finding.
- [x] Cache-bust and seed the live app; verify desktop/mobile, light/dark,
  shortcut, editor, DnD, 200%-equivalent reflow, console, and network behavior.
- [x] Run focused/full tests, typecheck, lint, build; restore generated noise and
  commit only scoped paths.

**Out of scope:** data/schema/sync/service-worker changes, prototype imports,
single-quadrant filtering/reordering, new persisted inspector/data state, deploy,
push, PR, or merge. The inherited `public/sw.js` version diff remains outside
this work.

**Verification:** focused contracts passed 243/243; the full Vitest suite passed
2,494 tests with 1 skipped. Typecheck passed. Lint passed with 0 errors and 10
known warnings. The 15-route static build passed. Impeccable detection returned
no findings, and the final changed-surface WCAG-AA review found no scoped
regressions after focus, contrast, touch-target, semantics, and safe-area fixes.
Targeted Chromium passed 20/20 across the hybrid, route navigation,
classification, and DnD; the navigation suite also passed 15/15 across three
repetitions. The hybrid passed 3/3 in WebKit; its shortcut path also proved modal
suppression and in-place focus restoration in both engines. A cache-busted, realistically seeded live
run unregistered 1 worker, cleared 2 caches, confirmed exact command/Help focus
restoration, found no failed requests or unexpected console issues, measured the
mobile capture edge at 772px above navigation at 783px, and found no horizontal
overflow. Light/dark desktop/mobile/Review screenshots were inspected.

**Limitations:** Firefox was unavailable because its Playwright browser executable
is not installed. No physical iOS, virtual-keyboard, real-touch, or VoiceOver run
was performed. Headless dev mode emitted known environment warnings for CSP
`frame-ancestors` in a meta tag, unsupported periodic background sync, and Next's
existing smooth-scroll advisory. Repeated WebKit dev-server runs after rebuilds
also logged transient stale-chunk errors; the cache-busted live run and final
browser assertions passed. No push, PR, deploy, or service-worker change was performed.

---

## Done — 2026-08-01: Explore five visual directions

**Branch:** `design/five-visual-directions` · **Tier:** Non-trivial (five full
interactive product concepts, shared state, documentation, browser evidence, and
cross-browser verification). **Approved contract:** attached user brief plus
`tasks/spec.md`.

**Plan (TDD + browser proof):**
- [x] Run branch preflight, preserve inherited stashes/`public/sw.js`, and create
  the isolated branch.
- [x] Load PRODUCT/DESIGN, project UI memory, design skills, tokens, accessibility,
  typography, motion, responsive, dashboard, form, and verification guidance.
- [x] Audit the live and local product surfaces and write the current-state report.
- [x] RED: add shared-data/palette/component/e2e contracts for the design lab.
- [x] GREEN: implement the overview, comparison mode, shared mock state, and five
  concept routes without importing production persistence or sync behavior.
- [x] Review changed React surfaces for WCAG AA and correct findings.
- [x] Cache-bust and capture 30 consistent Chromium desktop/laptop/mobile/editor/
  review/dark artifacts; verify behavior separately in Chromium and WebKit.
- [x] Write the comparison decision package and recommendation matrix.
- [x] Run install, focused/full tests, coverage, typecheck, lint, build, and
  targeted Playwright checks; commit only scoped design-exploration files.

**Out of scope:** production UI changes, persistence/sync/schema/service-worker
changes, deploy, push, PR, merge, or selecting/implementing a winner.

**Verification:** `bun install --frozen-lockfile` passed without dependency
changes. The full suite passed 2,416 tests with 1 skipped; coverage is 87.86%
statements, 81.19% branches, 87.43% functions, and 88.87% lines. Typecheck and
the 15-page static build passed. Lint passed with 0 errors and 10 pre-existing
warnings outside this work. Targeted Playwright passed 11/11 in Chromium and
11/11 in WebKit, including fresh-profile runtime isolation, responsive and
200%-equivalent reflow, 44px coarse targets, physical-key Option shortcuts,
reduced motion, theme/query state, and contained mobile preview navigation.
Production-build smoke covered 12 route/viewport states in each engine, and axe
reported 0 violations across the overview plus all five concepts in light/dark
(11 states). The evidence set contains 30 Chromium concept screenshots and 8
Chromium current-state baseline captures; WebKit is behavioral evidence, not a
second screenshot set.

**Limitations:** the prototypes are deliberately in-memory and omit persistence,
sync, production drag/drop, loading/offline/write-failure simulation, and a
winner migration. No VoiceOver, physical iOS, virtual-keyboard, real-touch, or
usability-study proof was performed. Three inherited stashes and the pre-existing
`public/sw.js` version diff remain untouched and outside the scoped commits.

---

## Done — 2026-07-31: Apply Violet Frost across the application

**Branch:** `codex/violet-frost-theme` · **Tier:** Non-trivial (shared color
contract, all routed surfaces, fallback documents, and shipped brand assets).

**Plan (TDD):**
- [x] Inventory runtime tokens, routed surfaces, exceptional fallbacks, linked
  documents, and static assets.
- [x] RED: lock the exact Violet Frost token, contrast, matrix-anatomy, navigation,
  fallback, semantic-class, and asset contracts.
- [x] GREEN: implement shared light/dark tokens and the approved matrix quadrant
  treatment.
- [x] GREEN: remove Tidewater/raw-color leaks from all routes, fallbacks, report,
  metadata, and static assets.
- [x] Verify focused/full tests, coverage, typecheck, lint, production build,
  accessibility review, and every route in a cache-reset live app.

**Out of scope:** feature, navigation, layout, typography, data-model, sync-protocol,
deployment, and unrelated repository-document changes.

**Verification:** full suite 2,389 passed / 1 skipped; overall coverage 89.28%
statements, 81.89% branches, 89.12% functions, and 90.26% lines; `bun
typecheck` passed; `bun lint` passed with 10 pre-existing warnings outside this
work; production static build passed. Accessibility review reported 0 Violet
Frost regressions. A reset-state production sweep covered all 16 routed/theme
combinations plus every Settings anchor and the standalone report with no page
errors, console errors, failed requests, token mismatches, or horizontal
overflow. Desktop and 390x844 matrix/settings screenshots were inspected in
both themes; temporary verification tasks were removed afterward.

**Resuming from here:** implementation and local verification are complete on
`codex/violet-frost-theme`; no deployment or publication was performed. Browser
chrome follows the OS-qualified metadata color, so a manual in-app theme override
can differ from the browser chrome until that can be synchronized without racing
Next.js head hydration.

---

## Done — 2026-07-30: Resolve Codex Security capture findings

**Branch:** `codex/fix-security-capture-sentry` · **Tier:** Standard (two bounded
frontend trust-boundary fixes with no new public API or architecture).

**Plan (TDD):**
- [x] RED: prove capture URL parameters open a prefilled create drawer without
  calling `createTask()`.
- [x] RED: prove cancelling the capture preview leaves persistence untouched
  while confirming creates exactly one task.
- [x] RED: prove Sentry scrubs capture fields from history breadcrumbs and event
  request URLs while preserving unrelated query parameters.
- [x] GREEN: route URL captures through the existing create drawer and add
  centralized Sentry telemetry URL scrubbing.
- [x] EXPANDED RED: prove bookmarklet task content stays in the client-only
  fragment, legacy query captures never reach controlled network/cache keys,
  and activation deletes legacy cache entries.
- [x] EXPANDED RED: prove the final Sentry envelope drops arbitrary task content,
  request payloads, user data, nested causes, AggregateError members, and
  encoded sentinels while retaining structural diagnostics.
- [x] EXPANDED GREEN: migrate the capture contract to
  `#action=capture&title=…&url=…&tags=…`, reject legacy query captures, and
  canonicalize service-worker requests/cache keys.
- [x] EXPANDED GREEN: replace the partial Sentry sanitizer with a bounded,
  fail-closed allowlist projection.
- [x] FINAL RED: prove a controlled legacy query navigation redirects before
  application HTML and preserves only unrelated query parameters.
- [x] FINAL GREEN: redirect legacy capture navigations at the service-worker
  boundary so startup subresources cannot inherit private capture fields.
- [x] Verify targeted tests, changed-file coverage, typecheck, lint, full tests,
  production build/browser behavior, and a fresh Codex Security scan.

**Out of scope:** nonce-based zero-click capture, broader task-form redesign, or
unrelated dependency/tooling changes.

**Verification:** full suite 2,322 passed / 1 skipped; overall coverage 88.89%
statements, 88.84% functions, 89.86% lines; changed capture/Sentry/cache files
meet the 80% statement/function/line standard; `bun typecheck` passed; `bun
lint` passed with 10 pre-existing warnings outside this work; production build
passed; accessibility review returned 0 findings. Live controlled-worker
verification cache-busted the service worker, proved fragment captures do not
reach network/cache/persistence before confirmation, and proved a legacy query
redirect leaves the browser and forced subresource `Referer` on the sanitized
URL. Codex Security scan `b2b28c65-3fa4-4d88-bec9-1457208d3aa0` confirmed both
original findings were gone and identified the final low referrer edge; focused
confirmation scan `d311a221-9e15-4eb1-917f-f53e4fc46690` reported 0 findings.
The latter marked coverage partial only for an unrelated page-cache growth
primitive whose hostile reachability and material impact were not established.

---

## Done — 2026-07-12: Handle failed view transitions without duplicate Sentry events

**Branch:** `fix/view-transition-rejection-telemetry` · **Tier:** Standard (two bounded frontend error-handling changes; no visual or public contract change).

**Plan (TDD):**
- [x] RED: prove rejected `ViewTransition.ready` promises are consumed while navigation still runs.
- [x] RED: prove the global rejection listener does not manually capture an event already owned by Sentry's browser integration.
- [x] GREEN: handle the transition readiness promise as progressive enhancement and keep the listener toast-only.
- [x] Verify targeted tests, typecheck, lint, full tests, build, and clean browser navigation including a forced invalid transition.

**Out of scope:** changing page-transition visuals, suppressing all `InvalidStateError` events globally, or modifying unrelated generated/version files.

**Verification:** targeted tests 16 passed; full suite 2,291 passed / 1 skipped;
typecheck and lint passed (11 pre-existing warnings); static build passed. Mobile
browser checks for normal navigation, forced invalid transition setup, and a
synchronous double-click all reached `/about/` with no page error or unexpected
error toast. The forced failure also passed against the built static export.

**Resuming From Here:** implementation is complete and scoped for commit. The
pre-existing `package.json` and `public/sw.js` version edits remain untouched and
outside this change.

---

## Done — 2026-07-10: Resolve all application-audit findings

**Branch:** `codex/fix-audit-findings` · **Tier:** Non-trivial · **Contract:**
`docs/audits/AUDIT-2026-07-10.md` plus the approved spec in `tasks/spec.md`.

- [x] C1 — onboarding dismissal state regression tests and fix
- [x] C2 — accessible Radix onboarding modal with focus restoration tests
- [x] C3 — transactional/idempotent recurring completion and pending UI guard
- [x] C4 — atomic task/dependency plus sync-queue mutation paths
- [x] C5 — status-aware failed-queue deletion reconciliation
- [x] C6 — MCP endpoint redaction and URL validation
- [x] C7 — Settings landmark/heading semantics
- [x] C8 — coarse-pointer touch targets and tablet matrix breakpoint
- [x] C9 — dependency updates and clean `bun audit`
- [x] C10 — full unit, coverage, typecheck, lint, build, and browser verification

**Verification:** root tests 2,285 passed / 1 skipped; coverage 85.87% statements,
79.45% branches, 86.61% functions, 86.85% lines; MCP tests 157 passed under
Vitest 4.1.10; typecheck, lint (0 errors), static build, and `bun audit` passed.
Live static-build checks confirmed immediate onboarding dismissal, forward/reverse
focus containment, replay focus restoration, one-column 768px layout, two-column
1024px layout, and 44px coarse-pointer targets with no browser console errors.

**Dirty-tree guard:** `public/sw.js` was modified before this implementation and must
remain outside scoped commits. The audit report is the implementation source artifact.

---

## Resuming From Here — 2026-06-23

**Active branch:** `chore/coding-standards-compliance`

**What was done in this session:** Full codebase compliance audit against `coding-standards.md`. Fixed all findings:
- Migrated `lib/use-error-handler.ts` off legacy `useToast()` to `sonner` directly (🔴 blocking)
- Fixed `scripts/test-coverage.sh` to use `bun run test` not `bun test` (🔴 blocking)
- Fixed `localStorage.clear()` → `removeItem()` in `tests/data/reset-everything.test.ts` (🔴 blocking)
- Added `FOCUS_DELAY_MS` constant to `lib/constants/ui.ts`; replaced two inline `50` literals
- Removed dead `eslint-disable-next-line no-unused-vars` in `lib/archive.ts` (rule is off globally)
- Added debug log to silent `catch {}` in `lib/sync/pb-auth.ts`
- Improved eslint-disable comment in `edit-drawer.tsx` with justification
- Added explicit return type to `resolveSyncDeps()` in `lib/tasks/import-export.ts`
- Extracted `useEditDraftState` hook + `edit-drawer-fields.tsx` sub-components; `EditDrawer` function now ~40 lines
- Extracted `useDashboardData` hook; `DashboardPage` now uses `DashboardContent` / `DashboardEmpty` sub-components
- Extracted `SyncHistoryRow` + `SyncHistoryStats` sub-components; replaced `window.confirm` with sonner confirmation toast
- Extracted `ArchivedTaskCard` sub-component from `ArchivePage`
- Cleaned up `tasks/todo.md` handoff state

**Next steps:** Run `bun typecheck` + `bun run test` on the branch, then open PR.

**Branches pending merge (pre-existing, from prior sessions):**
- `fix/sync-health-toast-dedup` — complete per 2026-06-20 entry below; awaiting commit/PR
- `chore/refactor-review-refine` — complete per 2026-06-19 entry below; "awaiting user go-ahead"
- `feat/design-reference-compliance` — complete per 2026-06-14 entry below; "ready to push + PR"
- `fix/security-medium-findings` — complete per 2026-06-10 entry below

---

## In progress — 2026-06-20: Fix stacked sync-health toasts (TDD)

**Branch:** `fix/sync-health-toast-dedup` · **Tier:** Standard (one hook + its single consumer; internal callback contract change; TDD).

**Problem:** On wake-from-sleep, multiple identical "N pending operations are older than 1 hour" toasts stack (user screenshot: 3 at once). Two root causes in `components/sync/use-sync-health.ts`:
1. `toast()` is called with no stable `id`, so sonner stacks duplicates instead of replacing (the user-visible defect).
2. The cooldown lives in React state (`lastNotificationTime`) that is also an effect dependency, alongside unstable `onHealthIssue`/`onSync` callbacks. Every status-poll re-render tears down and re-arms the health-check timers, so on wake several checks fire before the cooldown settles.

**Plan (TDD):**
- [x] RED: `useSyncHealth` passes a stable `id` (`sync-health-<type>`) + Sync Now action for a stale-queue warning. (3 RED failures confirmed: hook called `(message, action, duration)` positionally.)
- [x] RED: error issues pass `sync-health-<type>` and no action; non-stale warnings are ignored.
- [x] GREEN #1: derive a stable `id` from `issue.type` in a `buildNotification` helper; thread it to `toast({ id })` in `sync-button.tsx`.
- [x] GREEN #2: cooldown moved to a `useRef`; callbacks held in refs; effect depends only on `isEnabled` (no timer re-arm churn).
- [x] Guard: cooldown holds within window and across callback-identity changes; disabled + non-stale-warning branches covered.
- [x] Verify: `bun run test` ✅ 2013 pass / 1 skip · `bun typecheck` ✅ · `bun run test -- tests/ui/sync-button.test.tsx` ✅ 5 pass (consumer unaffected).

**Out of scope:** the underlying stuck sync operation itself (the message is legitimate; Sync Now flushes it). Only the duplicate-toast behavior.

**Files:** `components/sync/use-sync-health.ts` (rewrite: stable id + ref cooldown), `components/sync/sync-button.tsx` (pass `id` to `toast`), `tests/ui/use-sync-health.test.tsx` (new, 7 tests).

**Note on live verification:** no visual change (SyncButton renders identically); the fix is toast-dedup behavior under a wake-from-sleep timer race that requires sync-enabled + auth + a queued op stuck >1h to stage — impractical in a live browser and equally hard to drive via Playwright. Verified via deterministic fake-timer unit tests, which are the correct surface for this timing logic.

---

## In progress — 2026-06-19: Review-findings fixes (TDD)

**Branch:** `chore/refactor-review-refine` · **Tier:** Standard (bounded fixes across sync, import/export, MCP, db migrations; no new public contract). TDD per CLAUDE.md.

Source: full security/correctness/standards review (2026-06-19, 2 verification subagents). All Low/Info — no Critical/High.

- [x] **F1** — sync-coordinator: drain queue on backoff early-return (`lib/sync/sync-coordinator.ts`). RED→GREEN. **pb-sync-reviewer then found a BLOCKING double-run race** (isRunning cleared before drain → concurrent fullSync). Re-fixed: `isRunning` now held across the whole `requestSync` lifecycle (try/finally), `executeSync` no longer toggles it, `processQueue`→`drainQueue`/`runRequest`/`canRunAutoSync`. Regression test `should_never_run_fullSync_concurrently_*` pins it. pb-sync-reviewer re-review: **APPROVE, 0 findings.**
- [x] **F2** — export: `exportToJsonWithReport()` returns `{json, skippedCount}`; corrupt tasks skipped+counted (not thrown). UI shows `toast.warning`. a11y-reviewer: APPROVE. Corrected the mis-pinned "should throw on invalid" test (was passing only via undefined auto-mocked logger).
- [x] **F3** — MCP bulk: per-item `new Date().toISOString()` at apply time (was one batch-wide `now`). RED→GREEN (fake-timer concurrency test).
- [x] **F4** — MCP `escapeFilterValue` exported + 500-char length cap (mirrors web-app). RED→GREEN. (assertSafeRecordId-on-task_ids NOT added: escaping already blocks injection and the web-app doesn't assert task_ids either — verifier-confirmed non-exploitable.)
- [x] **F5** — realtime delete skips when a local queued op exists (mirrors reconcileDeletedTasks). RED→GREEN.
- [x] **F6** — reconcileDeletedTasks: comment documents self-healing via CURSOR_OVERLAP_MS + single-node assumption (pb-sync-reviewer nit folded in).
- [x] **F7** — db migrations v7/v9/v11: `.add()` → `.put()` for singleton seeds (matches v13). TDD-N/A (Dexie runs upgrades once); 53 migration tests stay green.
- [x] **S2** — retry-manager `getNextRetryDelay` throwaway wrapper collapsed to `failureCount ?? 0`; cache-contract comment added to `updateTaskInPBById`.
- [ ] **DEFERRED S1** — split `components/matrix-simplified/index.tsx` (separate PR, user decision 2026-06-19)

**Verify:** root `bun typecheck` ✅ · root `bun run test` ✅ 1998 pass / 1 skip · MCP `bun run test` ✅ 145 pass + `tsc --noEmit` ✅ · pb-sync-reviewer ✅ APPROVE · a11y-reviewer ✅ APPROVE (1 UX nit: optional longer toast duration) · `bun lint` pre-existing-broken on main (ESLint 10), not run.

Process: `lib/sync/**` changes → run `pb-sync-reviewer` before refactor/commit. `bun run test` (not `bun test`). NOT yet committed — awaiting user go-ahead.

---

## In progress — 2026-06-14: GSD Design Reference compliance (Buckets 1–4)

**Branch:** `feat/design-reference-compliance`
**Tier:** Non-trivial (coordinated changes across brand assets, card components, surfaces, new onboarding feature). Full process; TDD for behavioral changes. Spec = `docs/design-compliance-review.md` (approved by user 2026-06-14, "close Buckets 1–4, accept platform divergences").

**Context:** App already matches the reference's tokens/serif exactly; this closes the remaining gaps. Platform-inherent iOS divergences (swipe, detented sheets, haptics, type-scale density, serif numerals, side-drawer, delete+undo, smart-views sidebar) are **accepted, not fixed**.

**Guardrails:** 94 pre-existing staged `.agents/` files + `GSD-Design-Reference.html` are NOT mine — use targeted `git add` only, never `git add -A`. `bun lint` is pre-existing-broken on main (ESLint 10 crash) — do not block on it.

### Bucket 1 — Brand-asset migration drift (P1) ✅ committed 67129d0
- [x] 1.2 `components/gsd-logo.tsx` glyph: q1-q4 pigments + check on rust tile
- [x] 1.3 `components/about/matrix-section.tsx` all four → `bg-qN/12 border-qN/40`
- [x] 1.1 `public/icons/icon.svg` (+ regen 192/512 PNG) → 2×2 four-pigment + check, full-bleed maskable
- [x] 1.4 `public/manifest.json` theme_color→tide; background_color→ivory
- [x] 1.5 `public/og-image.svg` (+PNG) → warm paper + four pigments + serif title
- [x] 1.6 `app/globals.css` dead `--q3-soft/--q4-soft` → q3/q4; 1.7 deleted orphaned `public/css/*`

### Bucket 2 — Card anatomy (P1) — TDD ✅
- [x] 2.0 Derive quadrant in `TaskCard` from task.urgent/important (cleaner than threading a prop)
- [x] 2.1 3pt left accent spine = `var(--qN)` (data-testid task-card-spine)
- [x] 2.2 completion disc fills quadrant accent + paper-colored check (not green)
- [x] 2.3 tag chips → quadrant-wash bg + accent text
- [x] 2.4 subtask fill → quadrant accent (green preserved at 100%)
- [x] 2.5 blocked card → 0.62 opacity
- [x] 2.6 quadrant header fixed 26pt icon column (renders `meta.rdIcon`)
- [~] 2B card type scale (title 17 / desc 15 / meta 13) — SKIPPED: accepted density divergence (6.2)
- [x] 2C due-today tide-semibold (was amber); overdue warning glyph
- Tests: `tests/ui/task-card-anatomy.test.tsx` (6 new, red→green); 54 card/matrix tests green; typecheck ✅

### Bucket 3 — Surfaces + color discipline (P2) ✅
- [x] 3.4 editor quadrant picker: unselected cells carry pigment@0.35 (also fixed latent invalid `${var}14` bg → color-mix)
- [x] 3.5 due-date presets active = tide tint
- [x] 3.1 quadrant separation gap-4→gap-8 (phone); 3.2 `scroll-mt-24` on cards for capture-bar clearance
- [x] 3.7 archive cards dimmed 0.72 (handlers already no-op = read-only)
- [x] 7.1 Top Tags bars tide→graphite (bg-foreground-muted/30)
- [x] 7.2 toggles tide→green (Switch + .switch CSS → status-success/olive; checkboxes/radios kept accent = selection)
- [x] 7.3 dashboard stat/streak icons → graphite (no-flame streak kept per documented calm-voice decision)
- [x] 7.4 data-management ActionRow leading icons → graphite (danger stays rust)
- [x] 7.5 command palette: visible serif "Commands" title + --shadow-lg pop + backdrop scrim
- Tests: 163 green across dashboard/settings/palette/edit-drawer/archive/matrix/anatomy; typecheck ✅

### Bucket 4 — Onboarding + empty states (P1 user-facing) ✅
- [x] 5.1 4-screen skippable onboarding (Welcome→Matrix→Capture→Privacy) w/ dots, Skip, "Start using GSD" + quiet "Sign in to sync"; `OnboardingGate` (localStorage `gsd-onboarding-seen`, suppressed on /about,/install); replay from Settings→About via `gsd:replay-onboarding` event. Layered over the existing /about first-run redirect (kept intact).
- [x] 5.2 empty-state mark tile (quadrant icon in ink-3 on 60pt sunken tile)
- [x] 5.3 omit empty CTA in Eliminate (q4)
- Tests: onboarding (6) + onboarding-gate (4) + empty-state (3) red→green; e2e fixture seeds `gsd-onboarding-seen`; app-pages layout test mocks the gate. Full suite: 1977 pass / 1 skip; typecheck ✅.

**Status:** Buckets 1–4 implemented & committed. Platform divergences accepted (not built): swipe, detented sheets, haptics, type-scale density, serif numerals, side-drawer, delete+undo, smart-views sidebar.

**Verification (2026-06-14, live browser, dev):** PASS. All 4 onboarding screens; card spines in 4 pigments; completion disc fills quadrant pigment + paper check; tag chip wash/accent; 26pt header icon column; empty-state marks + Eliminate omits CTA; brand glyph 4 pigments. No console errors. Verified light + dark mode. Version bumped 9.9.1 → 9.10.0. Ready to push + PR.

---

## In progress — 2026-06-10: Fix 3 medium security-review findings

**Branch:** `fix/security-medium-findings`
**Tier:** Standard (3 bounded fixes across webapp sync + MCP server; no new public contract). TDD per CLAUDE.md.

**Findings (from full-codebase security review, 2026-06-09):**
- **M1** — `reportSyncError()` (`lib/sync/pb-sync-engine.ts:167-184`) persists/toasts/logs raw `errorObj.message`; PB 4xx bodies can echo task titles into `db.syncHistory`, toasts, and log metadata. Fix: route through existing `sanitizeSyncError()` → stable `SyncErrorCode`, matching the push path and `reportPartialFailure` precedent. Keep raw `errorObj` only in `logger.error` for diagnostics (pre-existing app-wide policy).
- **M3** — `deleteTask` dependency-cleanup (`packages/mcp-server/src/write-ops/task-operations.ts:349`) uses raw `console.error` with `error.message`, bypassing the structured MCP logger; PB 422 can echo titles into stderr. Fix: log via `createMcpLogger` with content-free context (taskId + numeric status), not the raw message.
- **M2** — Setup wizard artifact `~/.gsd-mcp-setup.json` holds the plaintext JWT until the user manually deletes it. Fix: new `src/cli/setup-artifact.ts` with `removeSetupArtifact()`; call it (a) at wizard start to clear stale artifacts and (b) at MCP-server startup once env config loads (artifact has served its purpose). Update wizard step-4 copy + README-SECURITY revocation note.

**Cycles (TDD — red first):**
- [x] **C1 (M1)** ✅ — red test in `tests/data/sync/pb-sync-engine.test.ts` (4 failures, raw title leaking) → `reportSyncError` now routes through `sanitizeSyncError()` → green 15/15. Updated 3 existing assertions that pinned the leaky behavior.
- [x] **C2 (M3)** ✅ — red test in `packages/mcp-server/src/__tests__/write-ops/task-operations-delete.test.ts` (console.error called) → `deleteTask` cleanup now logs via `createMcpLogger('TASK_OPS')` with `{taskId, status, errorName}` only → green 3/3.
- [x] **C3 (M2)** ✅ — red test for new `src/cli/setup-artifact.ts` (`getSetupArtifactPath`/`removeSetupArtifact`, homedir mocked) → green 3/3. Wired: wizard start (stale-artifact cleanup), wizard error path, `index.ts` MCP mode after `loadConfig()`. Wizard step-4 copy updated; README-SECURITY gained "Token Lifetime, Revocation, and the Setup Artifact" + corrected the "log out to revoke" advice (PB has no per-token revocation).
- [x] **C4 (reviewer nit)** ✅ — `pb-sync-reviewer` approved C1 but flagged `sync-coordinator.ts:142` (dead-in-practice re-throw path storing raw message, bypassing the new sanitization). Red: 4 updated + 1 new assertion in `tests/sync/sync-coordinator.test.ts` → green 18/18. Same `sanitizeSyncError` shim in `executeSync`'s catch.

**Verify:** root `bun run test` ✅ 1953 pass / 1 skip · mcp-server vitest ✅ 140 pass + `tsc --noEmit` ✅ · root `bun typecheck` ✅ · `bun lint` ❌ **pre-existing breakage on main** (ESLint 10.4.1 vs `@typescript-eslint/utils` "Class extends value undefined" crash — verified identical with all changes stashed; introduced by `3c6e810 Ran bun update --latest`, unrelated to this branch) · `pb-sync-reviewer` ✅ APPROVE (0 blocking, 1 nit → fixed as C4).

---

## Done — 2026-06-05: Standalone `/privacy` policy page + `/about` accuracy fix

**Branch:** `feat/privacy-policy-page`
**Tier:** Standard (new route + one content component + small `/about` fix + tests; bounded, no new public contract). Lightweight plan + TDD per CLAUDE.md.

**Why:** No privacy/legal route exists. The `/about` privacy section currently makes a **false claim** — "end-to-end client-side encryption… the server receives only ciphertext — it cannot read your tasks. Ever." But `lib/sync/task-mapper.ts` sends task content (title, description, tags, subtasks) to the server in **plaintext**. A privacy policy must be accurate, so this also corrects `/about`.

**Verified facts the copy must match (source = code, not marketing):**
- Local-first by default: data lives in IndexedDB (`lib/db.ts`); JSON export/import; works offline.
- Sync is opt-in (sign in with Google/GitHub OAuth → `lib/sync/pb-auth.ts`). Task content stored on `api.vinny.io` in plaintext; secured **in transit** (HTTPS) + auth + owner-scoped access. **Not** end-to-end encrypted.
- Error tracking = Sentry, **only if `NEXT_PUBLIC_SENTRY_DSN` is set** (`lib/sentry.ts`). Allowlist (`lib/logger.ts` `SENTRY_SAFE_METADATA_KEYS`) sends diagnostic IDs only (error type, user/task/device IDs, status codes); **task content is stripped** before egress.
- Backend infra described generically as **AWS** (per user) — hosts the app (CloudFront/S3) and the sync database. No "PocketBase" naming in user-facing copy.

**Decisions (approved):** document-style policy page; accurate sync wording + fix `/about`; disclose Google/GitHub OAuth, AWS (app + DB), Sentry, AWS hosting/logs. Contact `vscarpenter@gmail.com`. Last-updated June 5, 2026. Add a `/privacy` link to the `/about` footer.

**Acceptance criteria:**
- [ ] `/privacy` route renders inside `AppShell title="Privacy"` with `metadata` (title/description/openGraph).
- [ ] Document has: `<h1>Privacy Policy</h1>`, "Last updated June 5, 2026", and sections — Our Approach, What We Collect, Local-First Storage, Optional Cloud Sync, Third-Party Services, Error Tracking, Your Choices, Changes to This Policy, Contact.
- [ ] Sync section states data is encrypted in transit + access-controlled and honestly discloses it is **not** end-to-end encrypted. Page contains **no** "ciphertext" wording and makes **no** false E2E/zero-knowledge claim.
- [ ] Third-Party Services discloses Google/GitHub OAuth + AWS (app + database). Error Tracking discloses Sentry and that task content never leaves the device.
- [ ] Contact email present.
- [ ] `/about` privacy section no longer claims E2E/ciphertext; links to `/privacy`; checklist item reworded to "Optional secure cloud sync".
- [ ] `/about` footer links to `/privacy`.

**Cycles (TDD — red first):**
- [x] **C1 — `PrivacyPolicy` component** ✅ — `tests/ui/privacy-policy.test.tsx` (6 tests) red → built `components/privacy/privacy-policy.tsx` (title, date, 9 sections via local `Section` helper) → green.
- [x] **C2 — `/privacy` route** ✅ — `app/privacy/page.tsx` (AppShell + metadata); render test added to `tests/ui/app-pages.test.tsx` (red→green). Suite 9 pass.
- [x] **C3 — `/about` accuracy fix** ✅ — `tests/ui/about-components.test.tsx` +3 assertions (no "ciphertext"/"end-to-end"; `/privacy` link in section + footer) red → edited `privacy-section.tsx` (removed E2E claim, reworded checklist, added policy link) + `footer-cta.tsx` (footer link) → green. Suite 11 pass.

**Out of scope:** cookie banner (none exist), terms-of-service, GDPR/CCPA boilerplate beyond plain language, adding actual encryption.

**Verify:** `bun typecheck` ✅ · `bun run test` ✅ 1940 pass / 1 skip · `bun run build` ✅ (`/privacy` prerenders static) · `bun lint` ✅ 0 errors (10 pre-existing warnings, none in changed files) · `/verify-frontend-change` ✅ live browser, SW-cache busted.

**Review:** Shipped `/privacy` (document-style, 9 sections, editorial Inkwell styling) + corrected the false E2E claim on `/about` (section copy + checklist) and added `/privacy` links (about section + footer). Copy is grounded in code, not marketing: plaintext sync stored on AWS, encrypted **in transit** only, honestly disclosed as **not** end-to-end encrypted; Sentry disclosed with task-content stripped. Live-verified in browser: 9 sections render, accurate sync language present, no "ciphertext", both `/privacy` links work (rendered `/privacy/` under `trailingSlash:true`), clean console. Double-h1 (topbar + doc title) matches the existing `/about` shell convention — not a new regression. No e2e spec added (static page, strong unit coverage). Branch `feat/privacy-policy-page`.

**Advisor pass (accuracy hardening):** (1) Softened the Sentry "never sent" absolute — `error-logger.ts:59` calls `captureException(error, {...loggedError})` directly, bypassing the `logger.ts` `SENTRY_SAFE_METADATA_KEYS` allowlist, and Sentry's default `globalHandlers` auto-capture raw error messages/stacks; so the allowlist is not an app-wide guarantee. Copy now says error reporting is "designed to exclude" task content, not "never." (2) Fixed a self-contradiction: "By default, nothing… we do not collect personal information" vs. the disclosed AWS server logs (IP). "What We Collect" now scopes the no-collection claim to content and cross-references hosting logs. (3) Tightened "Our Approach" to "nothing you create is sent to a server." **Open before push:** confirm the `api.vinny.io` sync DB is actually on AWS (code only proves the static app is). → **Confirmed by maintainer: sync DB is on AWS.** Pushed; PR #354.

**Follow-up (discoverability):** added a "Privacy Policy" nav row to Settings → About (`components/settings/about-section.tsx`) linking `/privacy` via `next/link` with a chevron affordance (internal nav, distinct from the external GitHub/report rows). TDD: `settings-components.test.tsx` +1 (red→green) + `next/link` mock. Live-verified at `/settings#about` (renders, href `/privacy/`, v9.7.0). Console PASS — only the pre-existing app-wide theme-toggle hydration mismatch (reproduced on untouched `/dashboard`), not mine. Full suite 1941 pass.

---

## Known issue (unscheduled) — 2026-06-05: Topbar theme-toggle SSR hydration mismatch

**Severity:** low (cosmetic — React regenerates the subtree on the client, no functional break) · **Scope:** app-wide (topbar renders on every `AppShell` page) · **Tier when fixed:** Trivial (single component, ~3 lines; TDD optional — jsdom doesn't reproduce SSR/CSR hydration, so verify in a real browser console).

**Symptom:** On first load, the console logs `Hydration failed because the server rendered HTML didn't match the client.` Reproduced on `/dashboard`, `/settings`, etc. (not page-specific). The mismatch is the theme-toggle button (`aria-label="Toggle theme"`): prerendered HTML shows the `<SunIcon>` fallback with no Radix Tooltip wrapper (`data-state` absent), while the client's first render shows the resolved-theme icon (`<MoonIcon>` in dark) wrapped in the Tooltip (`data-state="closed"`).

**Root cause:** `components/theme-toggle.tsx:15` — `const [mounted] = useState(() => isBrowser)` where `isBrowser = typeof window !== "undefined"`. The lazy initializer makes `mounted` start as `true` on the client's **very first** render, so the client never produces a `mounted=false` render matching the prerendered HTML. The mount-guard pattern only works if the client's first render matches the server. The code comment "avoids useEffect" is precisely what breaks it.

**Fix:** revert to the canonical pattern — `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])`. First client render then matches the server (`mounted=false` → Sun fallback), and the effect flips it post-hydration. Re-verify by loading any page in a real browser with devtools open and confirming the hydration error is gone (jsdom won't catch it).

---

## In progress — 2026-06-03: Matrix aesthetic polish (4 impeccable recs)

**Branch:** `feat/matrix-aesthetic-polish`
**Tier:** Non-trivial (shared CSS + core matrix components). Visual/styling → TDD-optional per CLAUDE.md; verify via running suite + `verify-frontend-change`.

- [x] **#1 Radius hierarchy** ✅ — task card `rounded-xl`→`rounded-lg`; grid/quadrant-pane/capture-bar `rounded-2xl`→`rounded-xl`. Verified computed: card 14px inside 20px panel, both themes.
- [x] **#2 Quadrant color identity** ✅ — 3px top accent bar per pane (`quadrant-pane.tsx`). **No `overflow-hidden`** (would clip card action menus near pane edges on mobile, where the grid has no `md:overflow-hidden` mask); instead the bar's top corners `inherit` the pane radius → follow the 20px corner on mobile, square on the rounded-none desktop grid. Verified: 3px, rust=Q1, lifts to #D27468 in dark, `topLeftRadius:0` on desktop, `paneOverflow:visible`.
- [x] **#3 Flat-at-rest depth** ✅ — capture-bar resting `shadow-md` dropped (keeps `focus-within:shadow-lg`); task-card resting boxShadow `var(--shadow-card)` (dead/undefined) → `undefined`. Verified: card+bar `shadow: none` at rest, `shadow-lg` on focus.
- [x] **#4 Motion at sanctioned moments** ✅ — `check-pop` keyframe (literal cubic-bezier, NOT `var()` — Lightning CSS tree-shakes keyframes referenced via var() in the `animation` shorthand). **Gated to the complete *moment*** (false→true via a `useRef`, not on mount) — a page load showing done tasks is not a completion moment (brand: no page-load motion). Drop-target accent bar thickens via `scaleY(2)` (no reflow). Verified: 0 pops on load, 1 (`check-pop`) on toggle.

**Verify:** `bun typecheck` ✅ · `bun run test` ✅ 1930 pass · `bun lint` ⚠ env-broken (`@typescript-eslint/utils` FlatESLint module crash, pre-existing — unrelated to these CSS/className edits) · `/verify-frontend-change` ✅ live browser, light + dark, no console errors.

**Review:** All four landed and verified in the running app (light + dark) with precise computed-style evidence. No new tests (visual/styling → TDD-optional per CLAUDE.md; existing 1930 pass, none asserted the changed classes). Branch ready; not yet committed.

---

## In progress — 2026-06-01: Harden pass — `components/matrix-simplified` P1s

**Branch:** `fix/matrix-shell-harden`
**Contract:** critique snapshot `.impeccable/critique/2026-06-01T02-41-23Z__components-matrix-simplified.md` + approved plan (delete safety + keyboard a11y + touch targets, as one harden pass). Tier: Non-trivial; this todo + snapshot stand in for a spec.

**Cycles (one behavior each, TDD where testable):**
- [x] **C1 — data `restoreTask(record)`** ✅ — `lib/tasks/crud/restore.ts`, re-exported through the 3 barrels. 4 tests green, full suite 1925 pass, typecheck clean. `pb-sync-reviewer`: 0 blocking (verified delete→restore re-creates by `task_id`; keep original timestamp — do NOT bump, that would clobber concurrent edits under LWW).
- [x] **C2 — UI delete→Undo** ✅ — `index.tsx` `handleDelete` now calls `handleSuccess("Task deleted", () => restoreTask(task))` after delete; captures the exact record in the closure. Test in `matrix-simplified.test.tsx` green; full suite 1926 pass, typecheck clean. Logic-only change (no markup) → a11y-reviewer deferred to C3–C5.
- [x] **C3 — focus reveal** ✅ — `group-focus-within:opacity-100` on `DesktopActions` (task-card-actions.tsx) + drag handle (task-card-header.tsx). CSS-only.
- [x] **C4 — edit-drawer dialog semantics** ✅ — chose surgical harden (not Radix rebuild). New `use-dialog-focus.ts` hook (capture+restore focus, Tab trap) + `role="dialog"`/`aria-modal` on the form. 2 tests green (role/aria-modal + focus-restore); Tab-trap verified by a11y-reviewer (jsdom can't assert wrapping).
- [x] **C5 — touch targets ≥44px** ✅ — new `.touch-target` utility (globals.css, coarse-pointer gated) on the complete button, quadrant-add, and edit-drawer Close button. CSS-only.

**Known limitations / follow-ups (not this pass):**
- `restoreTask` restores the record but not inbound dependency edges stripped by `removeDependencyReferences` on delete. Undo copy must not over-promise.
- `restoreTask`'s local `db.tasks.add` + `enqueueSyncOperation` are not in one Dexie transaction (pb-sync-reviewer nit, rule 12): a crash between the two awaits leaves the task locally visible but unprotected from the next reconcile pull. Low-probability; matches the existing non-transactional `create`/`delete` pattern. Follow-up issue, not gold-plated here.

**a11y-reviewer follow-ups (deferred from this pass):**
- **DONE — keyboard drag-and-drop:** wired `KeyboardSensor` + `sortableKeyboardCoordinates` into `lib/use-drag-and-drop.ts` (TDD). Drag handle is now keyboard-operable.
- **DONE — colorize (P2):** card/sync layer realigned to Inkwell tokens (delete→rust, due→warning, subtask bar→status-success, sync→warning/info/success dots; completed check→sage at icon level).
- **DONE — distill (P3):** banned overdue side-stripe → full rust hairline border; dead `.overdue-task` CSS removed.
- **NEW follow-up — completion button `button-reset`:** its unlayered `color: inherit` neutralizes text/bg/border token classes ON the button (only the icon color renders). For a full sage ring+tint on the completed button, restyle the toggle (drop `button-reset`, add `appearance-none`) — affects both states, its own change.
- nit: `Field` component (edit-drawer) wraps button groups (Quadrant, Due date) in a `<label>` — replace with `role="group" aria-label` for those two (keep `<label>` for title/description). Pre-existing.
- nit: edit-drawer dialog could use `aria-labelledby` → the `<h2>` instead of `aria-label`; and `inert`/`aria-hidden` on background siblings for NVDA/Firefox virtual-cursor (aria-modal mitigates in Chrome/VoiceOver).
- nit: `use-dialog-focus` restore targets the captured node; if the originating card re-renders/moves quadrant, the node detaches and focus drops to `<body>`. Edge case.
- nit: edit-drawer initial focus uses `setTimeout(50)`; a `requestAnimationFrame` would close a tiny Tab-escape window (not changed — risks reintroducing this file's historic timer flakiness).

**Coverage-config gap (follow-up):** `vitest.config.ts` coverage `include` is `components/**/*.tsx` — so `.ts` files under `components/` (`use-dialog-focus.ts`, `use-smart-view-overflow.ts`) and `components/**/index.tsx` are never instrumented. Their logic IS tested (the trap hook has 5 passing tests; the delete→undo wiring in `index.tsx` is tested) — coverage just doesn't count it. Add `components/**/*.ts` to the include glob so these are measured.

**Process:** never commit on `main` (hook); `restoreTask` is a sync write path → `pb-sync-reviewer` before refactor; component edits → `a11y-reviewer` before refactor; `bun run test` (not `bun test`).

**Resuming from here:** COMPLETE + SHIPPED to PR #343 (3 commits on `fix/matrix-shell-harden`). Full critique remediation P1–P3: delete-safety (C1+C2) + keyboard a11y (C3/C4 + KeyboardSensor) + touch targets (C5) + colorize (P2) + distill (P3). Full suite 1935 pass, typecheck/lint clean. pb-sync-reviewer + a11y-reviewer: 0 blocking. **Live-verified in Chrome:** delete→Undo→restore (id preserved); completed check computes to sage `rgb(120,140,93)`. Impeccable setup (PRODUCT/DESIGN/.impeccable/CSP) shipped separately as PR #344. Remaining = the deferred follow-ups above (button-reset toggle restyle, dependency-edge restore, coverage-include `.ts`, Field role=group + other a11y nits).

---

## In progress — 2026-05-31: Smart-view strip overflow → "More" menu

**Problem:** `SmartViewStrip` renders 10 pills in a single `overflow-x-auto` row with a hidden scrollbar. The last pills clip off-screen with no affordance (see screenshot). User chose the **"More" overflow menu** fix.

**Tier:** Standard (one component subtree, no new public contract; real measurement logic → test-first).

**Design:**
- "All tasks" pill pinned inline first. As many view pills as fit render inline; the rest collapse into a Radix `DropdownMenu` triggered by a "More ▾" button.
- Measurement via a hidden, `aria-hidden` ghost row rendering all pills at natural width → read offsetWidths → pure greedy `computeVisibleViewCount()` decides the inline count. Recompute on mount + `ResizeObserver`.
- Reuse `components/ui/dropdown-menu.tsx` (Radix → free keyboard nav / focus / Escape / click-outside / `role=menu`).
- If the active view lives in the overflow set, mark the "More" button active so users see their filter is still applied.

**Files:**
- `components/matrix-simplified/use-smart-view-overflow.ts` — pure `computeVisibleViewCount` + `useSmartViewOverflow` hook.
- `components/matrix-simplified/smart-view-strip.tsx` — rewrite to use the hook + ghost + More menu.
- `tests/ui/smart-view-strip.test.tsx` — pure-fn algorithm cases + render/interaction tests.

**Acceptance:**
- [x] No pill clips off-screen at any container width; overflow pills are reachable via the More menu.
- [x] Selecting a view (inline or in menu) applies it; "All tasks" clears.
- [x] Active overflow view reflected on the More button.
- [x] Ghost layer is `aria-hidden` + `inert`; no duplicate buttons for AT.
- [x] `computeVisibleViewCount` covered: all-fit, none-fit, exact boundary, reserve-more boundary, empty.

**Review (2026-05-31 — done):**
- Implemented test-first (red/green/refactor): pure `computeVisibleViewCount` + presentational `SmartViewOverflowMenu` + strip behaviors + a faked-layout test driving the real measurement path.
- Verified in **real Chromium** (the gate jsdom can't own): at 1400px → 8 inline + "More (2)"; at 760px → 4 inline + "More (6)"; menu reveals overflow views w/ icons; selection applies; active-overflow filter surfaced in the More button's accessible name; **no horizontal page scrollbar** (scrollWidth === clientWidth).
- a11y-reviewer: 0 blocking. Fixed IMPORTANT (`role="group"` on the pill row — `aria-label` on a bare div is dropped by AT) + nit (comment on `aria-current` vs `aria-pressed`).
- Graceful degradation: unmeasured/zero-width container → show all inline (fixed a broken matrix-simplified test that relied on inline pills under jsdom's no-layout).
- Coverage: strip 96% / hook 95% (both >80% DoD). Full suite 1920 pass, typecheck 0, lint 0.
- Files: `smart-view-strip.tsx` (rewrite), `use-smart-view-overflow.ts` (new), `tests/ui/smart-view-strip.test.tsx` (new).
- **Not committed** — awaiting user go-ahead.

---

## Pending plan — 2026-05-18: GitHub Actions CI/CD deploy pipeline

Move dev + prod app deploys off laptops into GitHub Actions (OIDC, no long-lived keys), wire the `typecheck`/`lint`/`test`/`build` PR status checks already declared in `REPOSITORY_SETTINGS.md`, and gate CloudFront infra changes behind manual approval. 5-phase rollout, one PR per phase.

Full plan: `docs/superpowers/plans/2026-05-18-github-ci-deploy-pipeline.md`

Status: **Proposed — awaiting review.** Open decisions in §7 of the plan.

---

## Pending plan — 2026-05-18: Codex adversarial review fixes

5-PR plan addressing silent data-loss paths in sync/MCP/import.
Full plan: `docs/superpowers/plans/2026-05-18-codex-adversarial-review-fixes.md`

PR order (low risk → high):
1. PR1 — sync history `status='partial'` (Finding 5)
2. PR2 — replace import queues remote deletes (Finding 4)
3. PR3 — pull cursor clamp + overlap window (Finding 3)
4. PR4 — push LWW timestamp guard (Finding 1, **critical**)
5. PR5 — MCP `updateTask` fresh read + preflight check (Finding 2)

---

## Follow-ups from PR1 (Codex Finding #5 review) — 2026-05-18

- [ ] Render `failedCount` and `partialSyncs` in `app/(sync)/sync-history/page.tsx` (currently written but not displayed). Add a "Partial" stat tile and a "{failedCount} failed" line on partial rows.
- [ ] Status-driven coloring for the error pill on partial rows (line ~225-229) — currently hardcoded red regardless of status.
- [ ] Consolidate the three `recordSync{Success,Error,Partial}` writers into one helper or normalize their signatures (positional vs. options-object).

---

## Active task — 2026-05-14: Apply Inkwell Design System (1.3.1)

**Goal:** Make Inkwell 1.3.1 the canonical token + component source, wired through Tailwind v4's official integration. Eliminate the v3-style `tailwind.config.ts` as a competing styling system. Preserve GSD-specific tokens (quadrants, status, custom type scale) and the 1.5px border identity.

**Source of truth:** `https://github.com/vscarpenter/inkwell` `main` — `agent-instructions.md`, `DESIGN_SYSTEM.md`, `TAILWIND.md`, `inkwell-{tokens,components,theme}.css`.

### Findings from audit

- GSD already uses Inkwell-style tokens (`--ivory`, `--paper`, `--slate`, `--accent`) and applies Inkwell component classes (`.btn`, `.badge`, `.input`).
- Old monolithic Inkwell shim (`public/css/tokens.css`, 929 lines) is loaded via a `<link>` tag, *outside* Tailwind v4. Modern Inkwell ships as a 3-file split with an official `@theme` integration.
- `tailwind.config.ts` redeclares Inkwell tokens v3-style via `@config` — the competing system the user wants eliminated.
- `borderWidth: { DEFAULT: "1.5px" }` is load-bearing: bare `border` utility is used widely. Must preserve.
- Quadrant + status tokens are GSD-specific (not in Inkwell). Must migrate to `@theme` block.
- Dynamic class construction: none. All `bg-quadrant-*` / `bg-status-*` are static string literals. v4 scanner picks them up.
- A few hardcoded hex anti-patterns: `.overdue-task`, `complete-flash`, dialog `bg-black/40`.

### Plan (checkable items)

- [ ] Vendor Inkwell 1.3.1 into the bundler's reach (`app/css/inkwell-tokens.css`, `app/css/inkwell-components.css`, `app/css/inkwell-theme.css`).
- [ ] Refresh the public-facing copy at `public/css/{inkwell,tokens,inkwell-tokens,inkwell-components}.css` to match 1.3.1 (for any external consumer or service-worker cache).
- [ ] In `app/globals.css`: replace `@config "../tailwind.config.ts"` with `@import "./css/inkwell-theme.css";`. Add GSD-specific tokens (quadrant, status, custom type scale) inside a `@theme` block. Preserve the 1.5px border default via `@utility border { border-width: 1.5px; }`. Remove duplicate bridge aliases where Inkwell already provides the token.
- [ ] Remove the `<link rel="stylesheet" href="/css/inkwell.css">` from `app/layout.tsx` — Inkwell is now bundled via PostCSS.
- [ ] Delete `tailwind.config.ts` (no longer referenced).
- [ ] Anti-pattern sweep: replace hardcoded hex in `.overdue-task`, `complete-flash` with Inkwell tokens. Switch dialog overlay from `bg-black/40` to `var(--backdrop)`.
- [ ] Verify: `bun typecheck`, `bun lint`, `bun run test`, manual visual smoke test of the matrix shell in light + dark.

### Anti-goals (out of scope for this PR)

- Rewriting `.redesign-scope` / `.matrix-card` / `.rd-*` CSS into Inkwell classes — app-specific layer, not competing system.
- Migrating `border` → `border-hair` codebase-wide (preserved as project-specific override).
- Touching MCP server, sync engine, or any non-styling code.

---

## Resuming From Here (2026-04-28)

### Just Completed — v9 cleanup (Phases 1, 2, 3) on `claude/infallible-neumann-68a882`
Two commits, one PR:

**Commit 1 (Phases 1+3):** 6 unambiguously dead files removed; `@radix-ui/react-slider` dep dropped; `postcss` 8.5.8 → 8.5.10 + override (CVE GHSA-qx2v-qp2m-jg93 cleared); version 8.7.23 → 8.7.24.

**Commit 2 (Phase 2):** ~30 v8 surface files removed per user's per-cluster decisions. Cluster outcomes:
- Command palette: kept (resurrect later)
- Smart-view 1-9 shortcuts, smart-view UI, bulk multi-select, filter panel, settings modal, user-guide modal + wizard, modular task-form, tag inputs, share-task-dialog, matrix empty/skeleton states: deleted
- Cluster 11 split: `task-timer` and `import-dialog` kept (still wired); `snooze-dropdown`, `task-description`, `reset-everything-dialog` initially flagged dead but **restored after re-verification** — they're imported by `task-card-*.tsx` / `data-management.tsx`. Audit had a transitive-import gap (lazy/nested usage). `keyboard-hints-toast` deleted (truly dead).
- ADR 0011 written; CLAUDE.md updated.
- Version bumped 8.7.24 → 8.8.0 (substantial cleanup).

Verification on Phase 2 commit:
- `bun audit` — 0 vulnerabilities
- `bun typecheck` — clean
- `bun lint` — 5 warnings (1 fewer than baseline; unused-eslint-disable in deleted block)
- `bun run test` — 1773 passed (5 pre-existing edit-drawer failures unrelated; 315 fewer total because dead-code tests removed)
- `bun run build` — static export OK

PR: https://github.com/vscarpenter/gsd-task-manager/pull/238

### Open follow-ups

Each item below is sized to be a single self-contained PR. Pick any one cold and start.

#### 1. Wire `components/command-palette/` back into the v9 shell (cluster-1 resurrection) — ✅ DONE 2026-05-24
- Spec: `tasks/spec-command-palette-v9.md`.
- Implementation: added `showSmartViews` prop to `CommandPalette`, new `lib/use-shell-command-handlers.ts`, mounted palette in `AppShell`. Smart-view actions suppressed in v9 per ADR 0011.
- Tests: new `tests/ui/app-shell.test.tsx` (5 tests). Full suite: 1893 passing.
- Deferred: topbar ⌘K hint chip; deep-link export/import (handlers currently route to `/settings`); surfacing the new-task event listener on the matrix page (currently routes to `/?action=new-task` which the matrix already handles).

#### 2. Add explicit return types to live exported components
- **Why:** April 22 audit + 2026-04-28 review both flagged this. Standard requires `: React.ReactElement` (or `: JSX.Element`) on every exported component function. ~45 sites missing.
- **Where to start:** `components/matrix-simplified/*.tsx`, `components/task-card/*.tsx`, `components/settings-page/*.tsx`, `components/dashboard/*.tsx`, `components/about/*.tsx`, root-level live components. Skip `components/ui/*` (mostly typed via Radix already).
- **Acceptance criteria:**
  - Every exported component declared with `function Foo(...)` or `const Foo = (...) =>` has an explicit return type
  - `bun typecheck` clean; no behavior change
- **Effort:** ~2 hours, mechanical.
- **Tip:** can be split into 2-3 PRs by directory if the diff feels too large.

#### 3. Bump `lucide-react` 1.7.0 → 1.12.x
- **Why:** 5 minor versions behind. Risk: icon renames or removals between minors.
- **Where to start:** `package.json` dep + `bun install`. Then grep all `lucide-react` imports across `components/` for icons that may have been renamed in 1.8-1.12 release notes.
- **Acceptance criteria:**
  - All current icon imports still resolve
  - Visual smoke check: matrix view, capture-bar, edit-drawer, settings page, task card all render their icons
  - `bun typecheck` clean, tests pass, build succeeds
- **Effort:** ~30 min if no renames; ~1 hr if a few icons need renaming.
- **Anti-goal:** do NOT bundle other dep bumps — keep this isolated for easy revert if visual regression appears.

#### 4. Phase 4 — unit tests for critical untested modules (carryover from April 22 audit)
- **Why:** These modules can silently corrupt user data or fail sync. They had no unit tests before this PR and still don't.
- **Where to start:**
  - `lib/sync/pb-push.ts` (push engine; mock PocketBase; test happy path + auth fail + 429 + network error)
  - `lib/sync/pb-pull.ts` (pull engine; test merge with LWW timestamps + conflict resolution)
  - `lib/tasks/crud/{create,update,delete}.ts` (only barrel-tested today; need direct unit tests with cascade scenarios)
  - `packages/mcp-server/src/tools/handlers/write-handlers.ts` (external agents executing untested mutations)
- **Acceptance criteria:**
  - Each module has ≥80% line coverage (per project threshold in `vitest.config.ts`)
  - Tests are behavior-named, follow Arrange-Act-Assert, include both positive and negative cases
  - TDD enforced: write red test before implementation tweaks (per `.claude/commands/tdd`)
- **Effort:** ~14 hours total. Can split into 4 PRs (one per module group).

#### 5. Investigate the 5 pre-existing `tests/ui/edit-drawer.test.tsx` timeouts
- **Why:** These predate this PR (visible in baseline before any changes) but they fail every CI run. Either fix or delete.
- **Where to start:** `tests/ui/edit-drawer.test.tsx`. All 5 failures are `Test timed out in 5000ms.` — likely an unresolved promise or missing `await act()` around state-setting effects in `components/matrix-simplified/edit-drawer.tsx` (which already has a lint warning at line 62 about `setState in effect`).
- **Acceptance criteria:**
  - Either the tests pass deterministically (root-cause fix in component or test) or the tests are deleted with a short note in commit message
- **Effort:** ~1-2 hours debugging.

#### 6. E2E test gaps left by v9 surface removal (2026-05-11)
- **Why:** The original `tasks/e2e-testing-spec.md` was written generically and assumes UI affordances that v9 removed (per ADR 0011). The implemented suite covers the v9 surface; the items below are gaps **by design**, not omissions.
- **Smart views (`smart-views.spec.ts` from spec § Test Stubs):** Not implementable. v9 deleted the smart-view pinning UI, the 1-9 keyboard shortcuts, and the `useSmartViewShortcuts` hook. The Dexie `smartViews` table is retained for data continuity but has no entry point in the UI. **Action:** revisit if smart views are ever resurrected (similar to the planned command-palette resurrection in #1 above).
- **Search by subtask (`search.spec.ts` stub):** Search filter logic includes subtask titles in the haystack (covered by unit tests), but v9's edit drawer exposes no subtask editor — only a count badge on task cards. To exercise this end-to-end, either resurrect a subtask editor or seed subtasks via JSON import in a fixture.
- **Archive navigation:** The `/archive` route exists and is reachable from `Settings → Archive → View archive`, but that link is conditional on `archivedCount > 0`. Direct `page.goto('/archive')` works but doesn't validate the user-facing path. To cover this, the test would need to seed archived tasks first (via import, or by completing a task and triggering auto-archive with a backdated `completedAt`).
- **Effort to close:** ~3-4 hours, but blocked on UI decisions for smart views and subtasks.

#### 7. Adopt `knip` or `ts-prune` for periodic dead-code detection
- **Why:** This PR's audit used regex grep against import paths and **missed 5 transitive/lazy imports** (documented in ADR 0011's audit-gap section). A TS-compiler-API-based tool would catch them. Without one, the next "v10 refactor without cleanup" will need another manual review.
- **Where to start:** evaluate `knip` (more comprehensive, knows Next.js conventions) vs `ts-prune` (smaller, simpler). Add as a dev dep with config that:
  - Whitelists Next.js conventional entrypoints (`app/**/page.tsx`, `app/**/layout.tsx`, `next.config.ts`, etc.)
  - Whitelists test entrypoints
  - Whitelists `lazy()` and `dynamic()` imports
- **Acceptance criteria:**
  - `bun knip` (or equivalent) runs in CI and reports 0 findings on a clean checkout
  - Future dead code surfaces automatically
  - Optionally: add a Stop hook in `.claude/settings.json` to run it weekly per coding-standards.md guidance
- **Effort:** ~1 hour to install + configure + tune. Worth doing before the next v10/refactor cycle.

---

## Previous: Resuming From Here (2026-04-14)

### Recently Completed
- UX review implementation phases 1-3 (April 2026)
- Pre-launch checklist fixes
- Coding standards alignment updates

### Active Work — Coding Standards Compliance Sprint

Comprehensive audit completed against `coding-standards.md`. 24 issues identified.

**P1 — Critical:**
- [x] Fix 4 failing tests (`localStorage.clear` — replaced with targeted `removeItem` calls + added Storage polyfill in vitest.setup.ts)
- [ ] Add tests for 5 sync module files (background-sync, pb-auth, pb-realtime, pocketbase-client, notifications)
- [ ] Increase lib/db.ts coverage from 28% to 80%

**P2 — High:**
- [ ] Refactor TaskForm (245-line function → focused sub-components)
- [ ] Refactor FilterPanelComponent (272-line function → focused sub-components)
- [x] Replace `window.alert()` with `toast.error()` in smart-view-selector.tsx
- [ ] Write 6 missing ADRs (docs/adr/0004–0009): PWA, MCP, analytics, notifications, BFS algorithm, smart views
- [ ] Add tests for settings components (currently 0% coverage)
- [ ] Add tests for lib/reset-everything.ts (currently 0% coverage)
- [ ] Add tests for command palette (currently 0% coverage)

**P3 — Medium:**
- [ ] Add explicit return types to 15+ exported functions in lib/analytics/*, lib/archive.ts
- [ ] Create .claude/ directory (agent definitions + slash commands)
- [ ] Create root .env.example
- [ ] Document package.json dep rationale in CLAUDE.md
- [ ] Increase time-tracking CRUD coverage from 25% to 80%

**P4 — Low:**
- [x] Add `aria-label` to recurrence icon (task-card-actions.tsx:48)
- [ ] Extract magic numbers to named constants in lib/constants.ts
- [ ] Promote April 2026 audit lessons to CLAUDE.md
- [ ] Split multi-concept tests into single-assertion tests
- [ ] Add basic tests for About page + User Guide components

### Blockers
None currently.

### Next Session Starting Point
1. Run `bun run test -- --coverage` to see coverage delta
2. Resume sync module tests (`p1-sync-module-coverage`) — use `vi.mock('pocketbase')` pattern from existing tests
3. Check any outstanding agent results from current sprint

---

## Archived: UX Review (April 2026) — Complete ✅

**Review Date:** 2026-04-01 | **Source:** External UX review of gsd.vinny.dev

### Phase 1 — Quick Wins ✅
- [x] Simplify empty state with progressive disclosure
- [x] Add `destructive` button variant + migrate 4 components
- [x] Fix "Search..." ellipsis to "Search"
- [x] Add keyboard shortcut hints to header tooltips
- [x] WCAG AA contrast fix on accent color

### Phase 2 — Medium Effort ✅
- [x] Improve navigation hierarchy
- [x] Undo coverage audit (archive + smart view delete)
- [x] Touch targets increased to 44px minimum on mobile
- [x] "Saved locally" indicator for non-sync users

### Phase 3 — Polish ✅
- [x] Typography audit — already well-constrained
- [x] Card consistency audit — Matrix + Archive use TaskCard
- [x] Smart View language clarification (info tooltip)

---

## Follow-ups from PR5 (Codex Finding #2 review) — 2026-05-18

- [ ] Decompose `updateTask` (~126 lines) and `bulkUpdateTasks` (~149 lines) in `packages/mcp-server/src/write-ops/`. Suggested extractions: `buildUpdatedTask(currentTask, input)`, `diffChanges(currentTask, input)`, `writeOneWithPreflight(...)`. Both are well over the 40-line standard.
- [ ] Unify the conflict surface: have `bulk-operations.ts` catch `ConflictError` from a shared `writeOneWithPreflight` helper and push `err.taskId` to `conflicts`. Eliminates the duplicated `if (preflight.clientUpdatedAt !== X)` comparison and gives one definition of "conflict."
- [x] Rate-limit the fresh preflight and mutation as one serialized operation, keep 100 ms between operations even after failures, and honor one bounded PocketBase `Retry-After` retry.
- [x] Preserve non-404 PocketBase failures from `findPBRecordId`; only a real 404 maps to “Task not found,” so status and retry metadata reach the limiter.
- [ ] Add lessons.md entry: MCP write-path test fixtures didn't catch the original stale-spread bug because mocks never went stale between calls. Future tests should exercise the read→write timeline, not just data shapes.


---

## 2026-07-05 — Depends on field restored in v9 edit drawer (v10.2.0)

Spec: tasks/spec.md § 2026-07-05 · Plan: docs/superpowers/plans/2026-07-05-edit-drawer-dependencies.md
Branch: feat/edit-drawer-dependencies

- [x] DependenciesField component (chips, search ≤8 suggestions, self/selected/completed/cycle exclusions, 50-cap, ghost-ID preservation)
- [x] Drawer wiring (EditDraft.dependencies, allTasks prop, save-time cycle guard + inline error)
- [x] Shell wiring (allTasks to both drawers, create-path dependencies passthrough)
- [x] a11y hardening per a11y-reviewer (focus return after pick, Escape closes popup before drawer, text-rust contrast, aria-describedby/invalid)
- [x] pb-sync-reviewer: 0 blocking (ghost round-trip + cycle guard verified; diff UI-only for sync)
- [x] Live-verified in Chrome (SW-busted, seeded): link → Blocked by 1/Blocking 1 badges → IndexedDB round-trip → unlink; create-mode linking; console clean
- [x] e2e: tests/e2e/task-dependencies.spec.ts (chromium green; openEditDrawer now waits for title autofocus to settle)

**Resuming From Here / deferred follow-ups:**
- Full WAI-ARIA combobox semantics for the dependency picker (role/aria-expanded/aria-activedescendant + arrow keys) — a11y-reviewer finding #1; partial roles are worse than the current labeled tabbable buttons.
- Systemic danger-color token: text-red-400-on-white fails AA in sync-button.tsx:148 and sync-auth-dialog-sections.tsx:212 too — a shared token fix covers all.
- restoreTask does not re-create inbound dependency edges after delete/undo (pre-existing, noted above).
- Subtask editing still drawer-less (also lost in #238).

---

## 2026-08-14 — Impeccable audit remediation (P1 + P2)

Branch `fix/audit-p1-p2-remediation`. Audit report:
https://claude.ai/code/artifact/135957c7-806a-4cbe-9b02-1b9c6ddb440b

- [x] **P1** settings sidebar group labels — dropped `/80`; measured 3.72:1 → 5.69:1 light, 6.84:1 dark
- [x] **P1** `useCountUp` honors `prefers-reduced-motion` (extracted `lib/prefers-reduced-motion.ts`); predicate is evaluated *before* the NODE_ENV escape or it short-circuits away untested
- [x] **P2** reduced-motion reset no longer freezes `animate-spin`; duplicate reset removed from `inkwell-components.css`
- [x] **P2** `.button-reset` moved into `@layer components` — restores dead colour utilities on the dialog close button and task-card title
- [x] **P2** matrix grid sized by container query (`@min-[696px]`, capped at 2 cols)
- [x] **P2** desktop settings rail is a named `<nav>` landmark
- [x] **P2** per-quadrant render cap (`ACTIVE_RENDER_CAP = 50`) with a "N more" disclosure
- [x] **P2** coarse-pointer 44px floor made structural on `.btn`/`.input`/`.select` + pseudo-element hit expansion on checkbox/radio/switch

Verification: 2767 unit, 107 e2e (chromium), typecheck, lint. Live-verified in
Chrome light + dark, SW-busted and seeded with 59 tasks.

**Resuming From Here / deferred follow-ups:**
- All six **P3** findings are untouched by design (scope was P1+P2): dual type
  vocabulary, `--text-title` 18px vs DESIGN.md 19px, dead `.rd-serif` at
  `filtered-empty.tsx:31`, three dead animation utilities, mobile settings-nav
  overflow cue, `aria-current="page"` on section switchers.
- e2e ran chromium only; firefox/webkit not exercised for the new specs.
- The audit's tablet claim was **partly overstated**: 768px genuinely cannot fit
  two readable panes while the icon rail is expanded (506px available, ~696px
  needed). Collapsing the rail below `lg:` would be the real fix for iPad
  portrait, and is a separate design decision.
- `ACTIVE_RENDER_CAP = 50` was not profiled — it is a defensible budget, not a
  measured one.

### 2026-08-14 (cont.) — P3 remediation

- [x] **P3** off-ramp type sizes — `text-xl` (20px, no ramp step) → `text-h3` at 4 sites; DESIGN.md §3 gains the **One-Ramp Rule**
- [x] **P3** `--text-title` **and `--text-label`** removed — both were GSD-only aliases for steps Inkwell ships, both drifted off DESIGN.md; 10 call sites → `text-h3` / `text-eyebrow`
- [x] **P3** inert `.rd-serif` dropped from `filtered-empty.tsx:31`
- [x] **P3** five (not three) unreferenced animation utilities deleted
- [x] **P3** mobile settings nav gains a trailing mask fade (`data-testid="settings-nav-scroller"`)
- [x] **P3** `aria-current="page"` → `"true"` in both sidebar branches

Scope chosen by the user for the type-vocabulary finding: **off-ramp sizes only**,
not the 236-site migration to Inkwell names.

Verification: 2770 unit, 107 e2e (chromium), typecheck, lint. Live-verified in
Chrome — `text-h3` renders 19px/23.18px/−0.152px and `text-eyebrow`
11px/11px/1.32px, matching DESIGN.md exactly.

**Resuming From Here / still open:**
- **Detector is still at 22 advisories, unchanged.** All 22 are arbitrary
  `text-[Npx]` values (13px ×10, 10px ×6, 40px ×2, 18/22/26/27px) which the
  chosen scope did not cover. The One-Ramp Rule now states the policy; moving
  those onto ramp steps, or documenting them as real steps, is the follow-up.
- The detector cannot see fractional sizes (`text-[14.5px]`, `text-[12.5px]` on
  the task card) or named Tailwind steps at all — noted in DESIGN.md §3.
- `design-lab.spec.ts:119` flaked once under parallel load and passed on re-run
  and in isolation; it references nothing changed here.
- e2e still chromium-only.

---

## Resuming From Here (2026-08-15, editorial restore shipped)

**Done:** The GSD Editorial restore is complete and shipped as PR #502
(https://github.com/vscarpenter/gsd-task-manager/pull/502), six commits on
`design/editorial-restore` (reskin c37520b, ink unification a0bd5a8,
tailwind-merge ramp fix 3d25f41, test retarget b7637b0, docs rewrite f8ac76e,
two-voice finish ff3b94a). Gates: typecheck, lint, vitest (2773), and e2e
(327/327) green; quality:shape red but byte-identical to clean main (debt from
#498/#500). Visual QA passed light and dark; gsd-matrix.png recaptured;
GSD-Design-Reference.html byte-identical to the iOS repo copy.

**Next:** Vinny decides on PR #502: the version bump (11.11.12 today; 12.0.0
flagged) and merge. After merge: clean up the branch, then the follow-ups in
the PR body (RETIRED_COLORS rgba/tonal guard gap, report-page olive drift,
settings-sidebar.tsx:39 stale contrast comment, ratchet debt).

**Blockers:** none. **Assumptions on record:** hex-grep exemptions for
components/design-lab/design-data.ts and the RETIRED_COLORS list
(user-approved); the docs realignment (CLAUDE.md, PRODUCT.md, .ui-craft) was a
user-approved scope addition. package.json/bun.lock still carry the unrelated
pre-existing stagehand bump, deliberately uncommitted. PR screenshots can be
dragged into a comment from a fresh capture if wanted.

**Out of scope, still pending elsewhere:** gsdtaskmanager.com and gsd-iosapp
carry small uncommitted diffs from the same effort; they ship separately.
