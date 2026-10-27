# Session state, 2026-10-27: launch QA with five personas (`fix/launch-qa-first-run`)

## Resuming From Here

Non-trivial by size, but the owner asked for one pass ("fix it all in one pass, then rerun"), which stands in for the spec gate. Branched from main at `310e363`. Nothing pushed.

- [x] Built the production export (`bun run build:e2e`) and served `out/` on 127.0.0.1:3100 under the production CSP.
- [x] Five persona agents drove headless Chromium through a shared kit (fresh profile per run, production writes stubbed). Kit, reports, screenshots, and the merged list live in the session scratchpad under `qa/` (`RANKED.md`); they are not in the repo.
- [x] Baseline: 4 of 5 reached a first task; the impatient persona quit when its first task saved off-screen. 34 ranked findings, 2 dropped as artifacts (headless-only PWA warning; local rebuilds bump the build stamp).
- [x] Fixed so far: dates (`f5509c4`), drawer double-submit (`57241b0`), double-click on the next row (`6cb34ac`), capture feedback and named validation limits (`2a6aa4d`), capture bar copy (`383734d`).
- [ ] Three worktree agents in flight: copy and sync story; mobile layout and touch; breaker robustness. Merge each into this branch, then run the full gates.
- [ ] Rebuild, rerun all five personas with `QA_RUN=rerun`, compare against baseline.
- Parked for the owner (defaults kept): Terms of Service; privacy policy and FAQ text (marketing repo); capture parser odd-URL split (cross-platform contract); merge-import duplicates (backup contract, copy only); unknown URLs render the matrix (SPA fallback); phone keyboard handling (needs a real device); machine-speed typing (won't fix).

# Session state, 2026-10-23: undici and fast-uri advisories (`fix/undici-advisory`)

## Resuming From Here

Trivial tier: two overrides, the lockfile, and two guard-test pins, in two commits. Branched from main at `f1af139`. The owner approved push and PR with both fixes in one PR. Merging needs a separate OK.

- [x] Main went red after #628 merged. Security Audit run 40043842627 failed on GHSA-xjj6-f33q-929c (high, undici DoS through an unhandled error on excessive content-encodings, fixed in 7.30.1). Publish Docker Image run 40043842668 failed at its audit job and skipped the publish, so nothing shipped. CI and SonarCloud passed.
- [x] Same race as body-parser: GitHub published the advisory at 22:14Z, but bun's feed only had it after #628's audit passed (about 00:08Z) and before main's ran (00:13Z).
- [x] The path is jsdom (dev only) to undici. Bun 1.3.14's `--prod` audit still counts that path; bun 1.4.4's does not, so a local `--prod` run on 1.4.4 looked clean. Audit with the bun CI uses.
- [x] The root override pinned undici to exactly 7.29.1 (#568). Now 7.30.1, the fix on the same 7.x line. jsdom 30.0.1 asks for `^8.9.0`, and the override already held it on 7.x before this change. The guard pin failed first on 7.29.1.
- [x] This also clears the undici moderates GHSA-4qv8-2p9j-2685 and GHSA-f72v-6w45-q472. Bun 1.3.14: the frozen install passes, the checker reports "4 advisories, none blocking", and the `--prod` high audit exits 0.
- [x] fast-uri was another exact pin from #568, at 4.1.5. It had 2 moderate and 2 low advisories (GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr, GHSA-xhq7-xmqj-769h, GHSA-333x-w4r6-6crp), fixed in 4.2.3. The owner asked for it in the same PR. It reaches runtime through the MCP SDK's ajv, so the MCP build, tests, and stdio probe ran too. The guard pin failed first on 4.1.5. `bun audit` on 1.3.14 now reports no vulnerabilities at any level.

# Session state, 2026-10-23: ip-address advisory, shipped (PR #628)

## Resuming From Here

Trivial tier: one override, the lockfile, and a guard-test pin. Squash-merged as `f1af139` once all 5 required checks passed. The local branch `fix/ip-address-advisory` remains; deleting it waits on the owner.

- [x] GHSA-rxp7-6hxx-x8q5 and GHSA-p3hm-x653-5rc6 (both moderate) cover ip-address through 10.7.3. The root override pinned it to exactly 10.7.2, and update tools skip exact pins. Now 10.7.4, the fix and the latest, inside express-rate-limit's `^10.2.0`. The guard pin failed first on 10.7.2.
- [x] `bun audit` reports no vulnerabilities at any level. The frozen install passes on bun 1.3.14. Typecheck, lint, knip, and license:check pass. MCP: build, tests (350), stdio probe, and express-rate-limit loads with 10.7.4.
- [x] Root suite on Node 22.23.4 (official tarball, checksum verified): 3,573 passed. The shell's `node` had become 26.10, where `service-worker-privacy.test.ts` "deletes legacy capture entries" fails. Main `d4fc1ea` fails the same way on 26.10, so the failure predates this change.
- No release: the web app doesn't ship ip-address, and npm installs of gsd-mcp-server already resolve 10.7.4.

# Session state, 2026-10-23: zod security update, shipped (PRs #626 and #627)

## Resuming From Here

Shipped. Nothing is in flight.

- PR #626 (zod) squash-merged as `5ea7e8e`, on the owner's "merge it now, don't wait for webkit". Its WebKit e2e job was cancelled after 30 minutes stuck in "Install webkit", without running a test. WebKit passed on main's CI for `d4fc1ea`.
- On `5ea7e8e`, Security Audit failed on a brand-new advisory, GHSA-27r3-jxmh-p828 (body-parser below 2.4.0, high, published 20:53 UTC). It reached the tree through the MCP SDK's express. PR #626's audit had passed about 80 minutes after publication, so bun's feed lagged GitHub's. PR #627 raised the override floor to `>=2.4.0` with a guard-test pin, and squash-merged as `d4fc1ea`. CI, Security Audit, Publish Docker Image, and SonarCloud then went green.
- Tags on `d4fc1ea`: `mcp-v1.3.2` (annotated) and `v13.9.9`. The owner approved both environment gates in GitHub.
  - npm: `gsd-mcp-server` latest is 1.3.2 with zod 4.6.7 and attestations. The no-cache registry curl caught up about a minute after the run.
  - Production: Deploy Production Release run 40035411439 passed every job, including smoke. Prod `sw.js` serves 13.9.9, and the zod 4.6 chunk is live.
  - GitHub release v13.9.9 is published as Latest.
- Local branches `fix/zod-security-update` and `fix/body-parser-advisory` are merged and still present; deleting them waits on the owner.

Still open for the owner: winning back the 25.8KB (`zod/mini` or named imports), and the moderate `ip-address` advisory.

## Earlier notes from the branch

Standard tier: three manifests, the lockfile, and a guard test, with no new public contract. Branched from main at `06d3ed6`.

GHSA-mrhx-c7xc-m3w5 (high): zod through 4.6.5 keeps one issue object per failing array element, so a huge array exhausts memory. Patched in 4.6.6; 4.6.7 is the latest. Measured with the MCP `tags` schema and a 200,000-element array: 4.4.3 made 200,001 issues and grew the heap 172MB, while 4.6.7 makes 1 issue.

- [x] Red: `security-hardening-scripts.test.ts` pins zod 4.6.7 (root dependency, root override, MCP dependency) and checks that every `zod@` entry in `bun.lock` is at least 4.6.6. Both tests failed first on 4.4.3.
- [x] Green: zod 4.6.7 in both manifests, plus a root `overrides` entry. Stagehand 4.3.0 (the latest) still pins zod exactly 4.4.3, so without the override it keeps a nested vulnerable copy, the audit stays red, and `tools/stagehand` fails type checking. The lock was written with bun 1.3.14 (CI's version); it now holds one zod entry.
- [x] `bun audit`: the zod advisory is gone. The moderate `ip-address` advisory that was already there remains, and `--audit-level=high` exits 0.
- [x] Root gates: typecheck, lint, quality:shape, knip, license:check, test with coverage (3,573 passed, statements 89.98%).
- [x] MCP server: build and tests (350 passed). A stdio probe of the built `dist/` (HOME sandboxed) returned initialize, 19 tools, and two validation rejections. All 4 stdout lines were JSON-RPC.
- [x] Stagehand: loads under bun, its exported schemas are instances of the root zod, and `toJSONSchema` works. Its 44 unit tests pass.
- [x] Build passes; Chromium export e2e: 137 passed.
- [x] quality:bundle failed, and the cause is zod. 4.5 and 4.6 added `z.compile`, `.validate`, and `z.withParser` to the classic `z` namespace. `lib/zod.ts` re-exports the whole namespace, so the bundler keeps the compiler even though jitless mode never runs it. The zod chunk went from 82.7KB to 108.5KB gzip, adding 25.8KB to every route. The baseline was refreshed from a CI-matching build in a clean worktree, `742cb59`. The same worktree also passed typecheck, lint, knip, and 3,573 tests on a frozen install.
- [x] MCP 1.3.2 prepared, `d0096b7`: version, CHANGELOG, README, `public/index.md`, server card, and the `bun.lock` workspace line, hand-edited as in 1.3.1.
- [x] Version 13.9.9, `f6efa63`. Final HEAD: audit at high is clean, the frozen install passes, and so do quality:bundle, test with coverage (3,573 passed, statements 89.96%), and the MCP tests (350 passed).

Commits: `8a5024f` (zod and guard test), `742cb59` (budget), `d0096b7` (MCP 1.3.2), `f6efa63` (13.9.9).

Decisions recorded:
- Bundle: the 25.8KB was accepted. Winning it back means moving schemas to `zod/mini` or named imports, which is a separate refactor.
- The moderate `ip-address` advisory (GHSA-rxp7-6hxx-x8q5, <=10.7.3, through the MCP SDK's express-rate-limit) is still pinned at 10.7.2. The high-level gate ignores it.

# Session state, 2026-10-23: review range labels and copy (PR #625)

## Resuming From Here

Standard tier. The owner answered the three questions the polish pass left open. PR #625 squash-merged as `06d3ed6`; the local branch was deleted after verification.

- [x] Review chart period labels are "7d", "30d", and "90d", and the legend reads "Completion trend period in days". The old labels needed 312px against 276 at 390, so "90 Days" wrapped. New `layout-fit.spec.ts` case failed first (48px drift at 390).
- [x] Settings intro: "Change how GSD looks and when it reminds you. Sync your tasks, back them up, or bring back ones you deleted."
- [x] Sync sign-in dialog: "Your data is stored on GSD's own Cloud DB server." New unit test failed first.
- [x] Every CI gate passes locally: typecheck, lint, quality:shape, knip, license:check, test with coverage (3,572 passed, statements 89.98%), build, quality:bundle. Chromium export e2e after `build:e2e`: 137 passed.
- [x] Running app (built export, light and dark): the control is 229px, down from 312, and sits on one row at 1280, 390, and 360. Axe found nothing on the dashboard, settings, or sync dialog at 1280 and 390, and the console stayed clean.

Still wraps by design: at 320 the chart header has 206px, so "90d" drops to a second row. It wrapped there before too. Fitting 320 would mean dropping the checkmark's reserved space on unselected options below 360px.

# Session state, 2026-10-23: /impeccable polish (PR #624)

## Resuming From Here

Standard tier. A final polish after typeset, distill, clarify, and adapt. PR #624 squash-merged 2026-10-23 (main at `4675d18`) with all 13 checks green; the local `fix/final-polish` branch is deleted after verification. `chore/oss-scanner-enrollment` and its worktree are untouched.

Next: nothing in flight. The open questions below wait on the owner.

- [x] Version 13.9.7 (`package.json` and README line 7). Production already served cache version 13.9.6 from a repeat local build of 13.9.5, so 13.9.6 would not have rotated the pages and runtime caches. `8b6b681`.

- [x] Edit drawer: quadrant buttons are named by their visible text (WCAG 2.5.3, flagged by axe in both themes). The footer and discard prompt use the shared Button: Save is the tide primary, and touch targets went from 33px to 44px. `ef61bb4`.
- [x] Build date: the footer and Settings About read "Oct 23, 2026 at 10:29 AM", not "Oct 23 at 2026, 10:29 AM". `4294f8d`.
- [x] Copy: Archive and Sync history say "Open matrix" (the one label for that intent); the Sync settings, Delete account, Reset everything, and Share task dialog titles are sentence case. `3165ccc`.
- [x] Toasts use Inkwell status tokens. The light "Task added" toast was 4.25:1; every status now clears AA in both themes. `f7eebac`.
- [x] Verification: 32 rendered states (routes and overlays at 1280 and 390, light and dark) show 0 axe violations and 0 console errors. Every CI gate is green; test with coverage passed 3,571. New `tests/e2e/toast-contrast.spec.ts` and a discard-prompt case in `layout-fit.spec.ts` failed first. Chromium export e2e after `build:e2e`: 136 passed.
- [x] The `impeccable critique-storage` helper closed the stale 2026-06-01 matrix critique (the target changed since).

Open questions for the owner, left unchanged:
- The Review chart's 7 Days / 30 Days / 90 Days control wraps onto two rows on phones (needs 312px; 276 at 390, 206 at 320). Fixing it means shorter labels or dropping the selected checkmark on narrow screens.
- The Settings intro ends "...without losing the calm, editorial tone of the main app", which describes the design rather than the user's task.
- The sync sign-in dialog says "Your data is stored on your self-hosted PocketBase server", but the server is the owner's, not the user's.

# Session state, 2026-10-23: /impeccable adapt (PR #623)

## Resuming From Here

Standard tier. PR #623 squash-merged 2026-10-23 (main at `5e090bf`). Local `fix/help-copy-and-serif` and `fix/adapt-layout` are deleted after verification; `chore/oss-scanner-enrollment` and its worktree are untouched.

Next: nothing in flight. The impeccable audit's follow-ups are all on main.

- [x] A settings row wraps its control below the label when the control can't leave the label 8rem. At 390px the Theme label column went from 53px and four lines to one line; at 320px it was 0px. `f7a811a`.
- [x] Topbar search flexes from 12rem to 18rem, and sync plus the command button wrap as one unit at the right edge. At 1280px with 150% text the bar went from 187px on two rows to one 109px row; at 900px, from 125px to one 73px row. `49bcd71`, then `013e127` moved search into `TopbarSearch` for the code-shape ratchet.
- [x] Matrix row labels share the panes' row tracks, so they stay level with their rows when a short screen scrolls the stage. At 1280x800 the drift went from 122px to 0. `f3b8b6e`.
- [x] Verification: typecheck, lint, quality:shape, knip, license:check, test with coverage (3,562 passed), build, and quality:bundle are green. New `tests/e2e/layout-fit.spec.ts` and a 150% topbar case in `text-scaling.spec.ts` failed first for the right reasons. Chromium export e2e after `build:e2e`: 133 passed. Firefox and WebKit passed layout-fit, layout-overlap, and quiet-chrome.

By design: at 768px, and at 1152px with 150% text, the bar still takes two rows, with sync and the command button together at the right. On a 390px phone the Tasks breakdown and feedback type rows also stack now; at 320px the Build row does too.

Merge note: #622 merged first (`8452e57`); main was merged into this branch and both blocks kept.

With #622 and #623, every item on the impeccable "Noted, not done" list is handled.

# Session state, 2026-10-23: help drawer copy and serif fixes (`fix/help-copy-and-serif`)

## Resuming From Here

Standard tier. The owner approved push and PR on 2026-10-23 after reverting the font commit.

- [x] The help drawer's sync copy says what each badge shows (a count, an exclamation mark) instead of the retired "aubergine" and "coral". `65a585d`.
- [x] The help title drops the `<em>` around GSD that the browser drew as a fake italic. `65a585d`.
- [x] Newsreader's optical-size axis: tried in `47b95ad`, reverted by owner decision. Static weights stay; a comment in `app/layout.tsx` records why.
  - Cost: the Latin woff2 grew from 58,152 to 131,848 bytes. next/font only adds an axis alongside the full 200 to 800 weight range.
  - Gain: the 32px help title set about 2% tighter with finer hairlines. At 24px the change was hard to see.
  - Safari on Apple devices uses New York and never downloads Newsreader. `quality:bundle` counts JavaScript only, so CI can't see font growth.
  - Kept from that commit: `.ui-craft/tokens.md` no longer claims italic is loaded.
- [x] Verification: typecheck, lint, quality:shape, knip, license:check, test with coverage (3,561 passed; 89.98/84/90.19/91.12), build, and quality:bundle are green. Headless Chromium on the built export at 1280 and 390 shows the upright title and the new copy, with no console errors. Chromium export e2e after `build:e2e`: 129 passed. Firefox and WebKit e2e were not run locally; CI runs them.

Noted, not done (`/impeccable adapt`):
- At 390px the Settings Theme row's description wraps one word per line beside the segmented control.
- At 150% text on a 1280px screen the topbar wraps the ⌘ button onto a row of its own (header 187px).
- While the pinned stage scrolls (short screens), the row axis labels size to the stage, not the grid, so "Not important" drifts off the bottom row. Predates #620.

# Session state, 2026-10-23: /impeccable typeset (PR #620) and distill (PR #621)

## Resuming From Here

- [x] iPhone zoom fix merged as #619 (`39f25e2`): drawer and palette fields hold 16px on touch.
- [x] Type system, PR #620 merged 2026-10-23 (rebase merge, main at `01311f6`; spec `tasks/spec-type-system.md`).
  - The ramp is rem, and Tailwind's text-xs/sm/base/2xl are exact spellings.
  - Serif weight 600; headings in the serif, quadrant pane titles included; Numeral role.
  - No hand-set sizes remain, enforced by `tests/data/type-ramp-usage.test.ts`.
  - Reflows at 150% text, pinned by `tests/e2e/text-scaling.spec.ts`.
  - CI fix (`01311f6` on main): rem text squeezed the pinned matrix stage to 48px at 150% on 1280x720 (0px on Linux, so `waitForAppLoad` timed out). The shell now pins only at `pinned` (md and height >= 40rem, globals.css). The capture dock is `md:relative`, no longer sticky at 60px, and the rail is `md:overflow-clip` so its sticky column holds.
  - Verification:
    - CI commands: green.
    - Export e2e: chromium 129 passed; layout specs in Firefox and WebKit 30 passed.
    - Rendered axe across 32 states: 0.
    - Detector type scope: 34 to 0.
- [x] Distill, PR #621 squash-merged 2026-10-23 (main at `91f8332`; all 13 checks green). Each view now has one eyebrow at most.
  - The matrix eyebrow is aria-hidden, so "Today's matrix" is announced once.
  - Settings section headers lose the eyebrow, the tide icon tile, the gradient, and the off-ladder radius. Titles align with the rows.
  - The review prompts lose their section eyebrow; quadrant names become captions.
  - The help drawer drops its "Field guide" eyebrow.
  - Verification: CI commands green; rendered axe across 32 states: 0.

Next: nothing in flight. Local `fix/type-system`, `fix/audit-distill`, `fix/audit-polish`, and `fix/touch-input-zoom` are deleted; `chore/oss-scanner-enrollment` and its worktree are untouched. Pick up a "Noted, not done" item below.

Noted, not done:
- At 390px the Settings Theme row's description wraps one word per line beside the segmented control (`/impeccable adapt`).
- The help drawer copy still names the old "aubergine" and "coral" badges (`/impeccable clarify`).
- The help title's "GSD" is a synthesized italic.
- Newsreader's optical-size axis is unused.
- At 150% text on a 1280px screen the topbar wraps the ⌘ button onto a row of its own (header 187px).
- While the pinned stage scrolls (short screens), the row axis labels size to the stage, not the grid, so "Not important" drifts off the bottom row. Predates #620.

# Session state, 2026-10-22: /impeccable polish on branch `fix/audit-polish`

## Resuming From Here

Standard tier. Five fix commits on `fix/audit-polish`, not pushed; the owner decides on push and PR.

- [x] Switch off state uses `--control-border`: 3.38:1 light, 3.13:1 dark, measured (was about 1.5). `169c2c1`.
- [x] Edit drawer quadrant sub-labels drop `opacity-80` and clear 4.5:1. `c4103a0`.
- [x] About quadrant cards use `--gray-700` on their tints. `4267f3a`.
- [x] Due-this-week rows are plain paper instead of the `status-blocking` tide wash. `2397109`.
- [x] Help drawer leaves `.redesign-scope`; about 280 lines of legacy `.rd-*` CSS deleted; tide no longer decorates it. `65f304b`.
- [x] Verified: every CI job command passes (lint, quality:shape, knip, license, test with coverage, typecheck, build, bundle). Rendered axe on a fresh build across 32 states is now at zero for every rule, contrast included (13 before). Related e2e specs pass, except the cross-route capture test that also fails on main.

Next: owner says whether to push and open the PR. Remaining audit items route to `/impeccable typeset` (61 hand-set text sizes, sub-11px text, px-only ramp) and `/impeccable distill` (eyebrow count, the matrix heading's double announcement).

# Session state, 2026-10-22: /impeccable harden on branch `fix/audit-harden`

## Resuming From Here

Standard tier. Nine commits on `fix/audit-harden`, not pushed; the owner decides on push and PR.

- [x] Palette: only the selected row is filled, and it carries a 1px tide ring (5.13:1 light, 6.99:1 dark against the fill). `a673472`, `961150a`.
- [x] Settings: Show completed, Auto-sync and Auto-archive switches are named; every `Switch` answers a 44px tap on coarse pointers without growing. `a3186c1`.
- [x] Settings selects get their focus ring back (audit correction, WCAG 2.4.7). `c687010`.
- [x] About `<pre>`: focusable, named scroll region with an inset terminal-ink ring. `3ff4fda`.
- [x] Swipe: `pointercancel` and the row's own lost capture abort to the pre-gesture offset and never commit. `432ff3a`, then `43c1698` after real touch showed every swipe aborting on implicit capture.
- [x] Edit drawer: `role="dialog"` moved off the `<form>`, header and footer are no longer page landmarks, and Keep editing returns focus to the field in use. Archive list gained a hidden `<h2>`. `0d6c439`, `bac275d`.
- [x] Verified: `bun run test` 3,539 passed; typecheck and lint clean; rendered axe on a fresh build across 32 states shows every targeted rule at zero (only the two contrast findings routed to polish remain); real-touch swipe e2e fails with the bug and passes with the fix.

Not done, by decision: no version bump (fix PRs leave it to the release PR). Window `blur` is not handled; touch interruptions arrive as `pointercancel`.

Known, pre-existing: `production-hybrid.spec.ts` "delivers cross-route capture" fails on the dev server on unmodified main too. Four other e2e failures in a full run were dev-server load flakiness and pass in isolation.

Done since: #616 merged with its required `lint` red (the code-shape step); #617 fixed forward and main went green on `fc8fbd9`. gsd-mcp-server 1.3.1 published 2026-10-23 00:10 UTC from tag `mcp-v1.3.1` on `5039f88`, with provenance, SDK 1.32.1.

# Session state, 2026-10-22: Impeccable technical audit (read-only, no code changed)

## Resuming From Here

- Ran `/impeccable audit` on the web app at `d81a522` (v13.9.6) against the built export: source detector, CDP-rendered detector, axe 4.10 WCAG 2.2 AA across 6 routes x light/dark x 1280/390 plus editor, palette, onboarding and help drawer; Tab-order focus probe; real CDP touch on swipe rows. Score 14/20 (Good). No P0.
- P1, fix first: palette selection invisible (`data-[selected]:` matches `data-selected="false"`, `components/command-palette/command-item.tsx:24`, `task-item.tsx:39`); three switches with no name (`SettingsRow` label is a bare `<p>`, `components/settings/shared-components.tsx:21`); switch off-state boundary 1.5:1 (`components/ui/switch.tsx` uses `border-border`, not the control-border token); editor quadrant sub-labels 3.49 to 4.14:1 (`edit-drawer-fields.tsx:77`); About quadrant cards muted text 4.03 to 4.16:1 (`components/about/matrix-section.tsx:70`).
- P2: a `touchcancel` past the full-swipe threshold completes the task (`components/task-card/use-swipe-gesture.ts:171` routes cancel to `pointerEnd`); px-only type ramp ignores the browser font-size preference (`app/css/inkwell-tokens.css:98-105`); 61 arbitrary `text-[Npx]` sizes, 17 distinct, 11 fractional, some at 9 and 10px; About `<pre>` not keyboard-scrollable (`components/about/terminal-block.tsx:65`).
- Verified false positives: detector `cream-palette` and `nested-cards` (both pinned by DESIGN.md), `outline-none` matches (global unlayered `*:focus-visible` wins), dashboard 1x1 radios (labels 81 to 89 x 56px).
- Not tested: WebKit or a physical device for touch, touch drag between quadrants, reset/delete/import/share/sync dialogs, a real screen reader.
- Next: owner picks which `/impeccable` follow-ups to run (harden, polish, typeset, distill). Nothing is staged; this block rides the next branch.

# Session state, 2026-10-22: include all current dependency updates in PR #614

## Resuming From Here

- The owner approved including all existing dependency updates in [PR #614](https://github.com/vscarpenter/gsd-task-manager/pull/614), on `fix/next-security-browser-validation`. The earlier decision to leave Stagehand/Playwright changes unstaged is superseded.
- Include Stagehand `^4.2.0 -> ^4.3.0`, Playwright `^1.64.0 -> ^1.64.1`, and all 44 existing changed package records in the lockfile. These include the existing Vite/PostCSS/Rolldown, Radix, Browserbase SDK, OpenTelemetry and other transitive updates. No new package update was run or version selected in this follow-up. Next.js and eslint-config-next remain pinned to 16.4.1.
- Preserved the complete dependency snapshot byte-for-byte: manifest SHA-256 `b800a2efee3f7251ff34f07e69ab3eeb2b2fbb8472bb481792b6fa8a99d05700`; lock SHA-256 `60a9d96e85abad7f9ee40481d8f05595f0258b336b2d60874c87c2bbd26245fa`. Installed Stagehand is 4.3.0 and Playwright is 1.64.1.
- Fresh validation used Bun 1.3.14 through `bunx --package=bun@1.3.14 bun`: frozen install, lint, typecheck, full unit coverage, license check and production audit passed. Unit result: 3,519 passed, 1 existing skipped; statements/branches/functions/lines 89.93/83.99/90.03/91.07%. Licenses approved 723 installed versions. The new unit log is `/tmp/gsd-all-deps-unit-coverage.log`.
- Exact fresh commands: `bunx --package=bun@1.3.14 bun install --frozen-lockfile`; `bunx --package=bun@1.3.14 bun lint`; `bunx --package=bun@1.3.14 bun typecheck`; `bunx --package=bun@1.3.14 bun run test -- --coverage`; `bunx --package=bun@1.3.14 bun run license:check`; `bunx --package=bun@1.3.14 bun audit --prod --audit-level=high`.
- Raw `bunx --package=bun@1.3.14 bun audit --audit-level=high --json > /tmp/gsd-all-deps-audit.json` exits 1 for the existing accepted high-severity braces advisory. The fresh audit also lists moderate ip-address GHSA-rxp7-6hxx-x8q5 at installed 10.7.2; that package record is identical in the initial PR and the complete snapshot. `node scripts/check-audit-results.cjs /tmp/gsd-all-deps-audit.json` passes: two advisories, none blocking under unchanged policy. No suppression or exception was added; this follow-up does not remediate the moderate finding.
- The preceding working-checkout validation already exercised this exact complete manifest and lockfile: 352 browser cases passed with 2 existing native-clipboard skips, plus production build/export, bundle, CSP, all-three-browser PWA, development feedback and MCP checks. Hashes were verified before reusing that evidence; those browser/build checks were not rerun solely to change Git staging. The older narrow PR snapshot below remains historical evidence for the initial commit, not the final dependency scope.
- Stagehand module-load verification passed under Node with `fetch` disabled: `Stagehand`, `Stagehand.create` and `localBrowser.launch` exports are present. Provider-backed Stagehand smoke was not run because it calls an additional AI account. Its transitive OpenTelemetry core 3.0.0 declares API peer `>=1.10.0 <1.11.0`, while API 1.9.1 is installed. Module load and local tests pass, but this peer-range discrepancy remains a tooling compatibility limitation for review; no speculative dependency change was made.
- Update the existing PR description to match the full scope. No merge, release, deployment, Aikido rescan, account access or security-setting change is authorized/performed. Final chat handoff records the follow-up commit, push and CI state.

# Historical evidence, 2026-10-22: browser validation repair and initial PR

## Resuming From Here

- Authorized: fix feedback/CSP test-origin mismatch and Firefox profile launch, preserve existing changes, validate, create a branch, push and open a PR. No merge or deployment.
- Standard tier: bounded test-tooling changes with no application interface or production security-policy change.
- Branch: `fix/next-security-browser-validation` from `479fc798a9287099bfe6b0fef50f504cfbc294e4`. Preflight found only the five known modified files; no conflict markers or stashes.
- Completed: reproduced both failures, configured an export-test build for the CSP-approved backend, isolated Firefox app-data on macOS with deterministic teardown, and validated both the working checkout and the exact staged PR snapshot.
- Baseline RED: focused Chromium feedback suite reproduced exactly four CSP failures and one pass. Plain Firefox launch reproduced `Could not find profile folder`; the same Firefox 157 binary launched successfully with a private `CFFIXED_USER_HOME`. New build/CI regression checks failed before implementation.
- Implementation: `build:e2e` compiles the existing hosted backend override; CI uses it. Feedback stubs and runtime-error guards remain intact. Shared Firefox-home lifecycle covers worker launch options and the PWA verifier; only macOS Firefox uses it. Teardown removes the ACLs macOS creates inside the disposable home, then deletes it. Regular profiles, system privacy grants, sandbox settings and production CSP are unchanged.
- References: https://github.com/microsoft/playwright/issues/42768 and https://github.com/microsoft/playwright/pull/43494. Registry's latest stable remains 1.64.1; the upstream Firefox roll is in the upcoming 1.65 line. No dependency upgrade or system privacy grant is used for the workaround.
- Independent read-only review: no actionable findings; challenged request interception, CSP, environment merging, browser/worker lifetimes, cleanup and test guards. This was source review, not separate test execution or deployment proof.
- PR scope: Next.js 16.4.1, its existing regression guard/security documentation, and these browser repairs. Pre-existing Stagehand `^4.3.0` and Playwright `^1.64.1` updates stay local and unstaged. The PR retains HEAD's Stagehand `^4.2.0` and Playwright `^1.64.0`; its isolated frozen installation actually resolved Playwright 1.64.0 / Firefox 157.0 and passed validation below.
- Publication is authorized for this branch; the final chat handoff carries commit/push/PR proof. Next gates: review GitHub CI, merge only with separate authorization, then authorized deployment and an Aikido rescan of the exact intended commit. No merge, deployment, production probe, advisory suppression or new audit acceptance was performed.

## Validation commands and evidence

All Bun commands used `bunx --package=bun@1.3.14 bun` on Node 22.22.3 / macOS 27.0.1. In the table, `bun ...` abbreviates that exact launcher. PR checks ran from a temporary, ignored copy of the Git index inside this authorized checkout, with its own frozen installation. No working manifest or lockfile was replaced to test the PR.

| Command | Working checkout | Exact PR snapshot |
| --- | --- | --- |
| `bun install --frozen-lockfile` | PASS, no changes | PASS; 692 packages installed; lock digest unchanged |
| `bun run test -- tests/data/export-journeys.test.ts tests/data/firefox-test-home.test.ts tests/data/e2e-quality-gates.test.ts tests/data/production-pwa-verifier.test.ts` | PASS: 19 tests | Covered by full suite |
| `bun run test -- tests/data/firefox-test-home.test.ts --coverage --coverage.include=scripts/lib/firefox-test-home.cjs` | PASS: 3 tests; helper 100% statements/functions/lines, 85.71% branches | Same helper coverage in full suite |
| `bun run test -- --coverage` | PASS: 3,519 tests; 1 existing skipped; 272 files passed, 1 skipped. S/B/F/L: 89.94/83.99/90.08/91.07% | PASS: same test counts; S/B/F/L: 89.93/83.99/90.03/91.07% |
| `bun lint` | PASS, zero warnings | PASS |
| `bun typecheck` | PASS | PASS |
| `bun run quality:shape` | PASS: complexity 30/30, depth 4/5, lines 0/0, function length 92/268 | Same source; no thresholds changed |
| `bun run license:check` | PASS: 723 installed versions | PASS: 692 installed versions |
| `bun audit --prod --audit-level=high` | PASS: no reported vulnerabilities | PASS |
| `bun audit --audit-level=high --json > /tmp/gsd-browser-audit.json` | FAIL, exit 1: only existing dev-only braces GHSA-vfj7-8cjw-p6xm | Same result, saved as `/tmp/gsd-pr-audit.json` |
| `node scripts/check-audit-results.cjs /tmp/gsd-browser-audit.json` | PASS using unchanged existing acceptance through 2027-01-05 | PASS with `/tmp/gsd-pr-audit.json`; no new exception |
| `NEXT_DISABLE_SWC_BINARY=1 NEXT_CACHE_DIR="$PWD/.next-cache" bunx --package=bun@1.3.14 bun run build:e2e` | PASS: Next 16.4.1; 9 static pages; 31 script blocks and 1 style externalized | PASS, same output; no font-loader failure |
| `bun run quality:bundle` | PASS within original budgets, including the existing 5,120-byte allowance | PASS |
| `bun run test:csp` | PASS, 3 externalized assets | PASS |
| `bun run test:pwa` | PASS: Chromium, Firefox, WebKit | PASS: all three |
| `bun run test:e2e:export -- tests/e2e/feedback.spec.ts --workers=2` | PASS: all 15 tests | Covered by full browser suite |
| `bun run test:e2e:export -- --workers=2` | PASS: 352 passed, 2 existing skipped, zero failures/flakes/retries | PASS: same counts; every report result checked |
| `bun run test:e2e -- tests/e2e/feedback.spec.ts --workers=2` | PASS: all 15 tests on development server | Shared fixture; full export suite above |
| `bun run --cwd packages/mcp-server test:coverage` | PASS: 350 passed, 6 existing skipped | No MCP dependency/source changes in PR |
| `bun run --cwd packages/mcp-server build` | PASS | No MCP dependency/source changes in PR |
| `git diff --check` and `git diff --cached --check` | PASS | PASS |
| `git diff --cached \| gitleaks stdin --redact` (with pipefail) | PASS: no leaks in staged diff | Same staged source |

The two browser skips are the existing native-clipboard case in Firefox and WebKit. Chromium passed 118 cases; Firefox and WebKit each passed 117 and skipped one. No skips, retries, console allowances, budgets, CSP directives or audit exceptions were added or widened. The staged snapshot's report is retained locally at `playwright-report/pr-validation/index.html`; generated reports are not committed.

The first focused checks deliberately failed before implementation: two build/CI guards, the four Chromium feedback cases, and an ordinary Firefox launch. Firefox's control launch with private app-data succeeded with the same binary. Two PWA-helper import runs eventually passed after about 120 seconds; moving Playwright's import to the launch path reduced the four-file focused run to 0.44 seconds without dropping checks. Initial audit-tool invocations used a nonexistent `scripts/check-security-audit.cjs`, then omitted the required filename for `check-audit-results.cjs`; the corrected, successful invocations are listed above. These were invocation errors, not dependency-check passes.

## Preservation and release status

- Working lockfile SHA-256 remains `60a9d96e85abad7f9ee40481d8f05595f0258b336b2d60874c87c2bbd26245fa`, byte-identical to the start of this browser repair. The only new working-manifest change is the dedicated build script.
- Staged manifest SHA-256: `9583dbbb001dcdcdbdce885c8c8a4aeb94acf0e4e4f61e0cabd72cbcaba0e075`; staged lock: `bb97f339a4468aa0daf5deef2305747ca9d5e21ca071abefe633f015d48a07dc`. Compared every staged lock record: only the twelve Next records differ from HEAD, plus the two workspace pins; unrelated user records remain outside the PR. Frozen installation of this exact snapshot passed.
- Checked all fifteen staged files against the independently installed/tested snapshot before removing that temporary source/dependency copy. Next-generated development edits to AGENTS.md's heading and next-env.d.ts type paths were restored; tracked CSP, service worker, TypeScript configuration and budgets were preserved.
- Browser release blockers from the previous entry are resolved locally. The raw braces audit remains as disclosed above under existing repository policy. The earlier intermittent font-loader observation did not recur in these builds. GitHub CI, deployment and Aikido clearance remain separate evidence stages.

# Session state, 2026-10-22: authorized Next.js 16.4.1 upgrade

## Resuming From Here

- Upgrade applied locally: **next 16.3.8 -> 16.4.1**, **eslint-config-next 16.3.8 -> 16.4.1**, following the owner's explicit approval and upstream GHSA-673q-mjm6-r5xr guidance. Both manifest pins, lock records and installed packages agree.
- Preserved existing Stagehand `^4.3.0`, Playwright `^1.64.1`, and all unrelated manifest content. Compared every lock entry with the pre-upgrade snapshot: **12 Next-related records changed; all 889 unrelated records are unchanged**. Lock metadata differs only in the two requested workspace pins.
- Related records now at 16.4.1: Next, eslint-config-next, @next/env, @next/eslint-plugin-next, and eight optional SWC platform packages. Installed Darwin ARM64 native binding is 16.4.1. Root React/React DOM stay 19.3.0; root TypeScript 6 API plus native TypeScript 7 CLI are preserved.
- Raised the existing build-configuration security guard to 16.4.1, retained exact Next/lint alignment, and proved red before the dependency change, then green after it. Updated SECURITY.md's earlier no-upgrade disposition.
- Two fresh independent read-only reviews completed: pre-patch compatibility investigation and post-patch security/regression review. No actionable findings. The reviewer also checked the 12 package integrity values against published npm metadata; runtime validation and dirty-tree preservation were verified by the parent.
- Current working branch remains main at `479fc798a9287099bfe6b0fef50f504cfbc294e4`. Changes are uncommitted: repository policy prohibits commits on main and the owner prohibited a branch. No push, PR, tag, publication, deployment, account, credential, security-setting or advisory-exception change was made.

## Exact upgrade and validation commands

Run in this checkout with Node **22.22.3**. Every Bun command below uses the repository's **1.3.14** launcher, rather than installed global Bun 1.4.2.

| Command | Result |
| --- | --- |
| `bunx --package=bun@1.3.14 bun pm view next@16.4.1` | PASS: published version and metadata verified |
| `bunx --package=bun@1.3.14 bun pm view eslint-config-next@16.4.1` | PASS: published version and compatible peer/dependency requirements verified |
| `bunx --package=bun@1.3.14 bun run test -- tests/data/build-config.test.ts -t 'pins next and eslint-config-next'` | Intentional RED before upgrade: version-floor assertion failed on 16.3.8; other tests were outside this focused selection |
| `bunx --package=bun@1.3.14 bun install` | PASS: installed exact 16.4.1 pair; seven packages installed; lockfile regenerated |
| `bunx --package=bun@1.3.14 bun run test -- tests/data/build-config.test.ts` | GREEN: all 17 tests passed |
| `bunx --package=bun@1.3.14 bun install --frozen-lockfile` | PASS: 733 installs checked, no changes |
| `bunx --package=bun@1.3.14 bun lint` | PASS, no warnings |
| `bunx --package=bun@1.3.14 bun typecheck` | PASS |
| `bunx --package=bun@1.3.14 bun run test -- --coverage` | PASS: 3,515 tests passed, 1 existing skipped; 271 files passed, 1 skipped; statements 89.93%, branches 84.04%, functions 90.07%, lines 91.05% |
| `bunx --package=bun@1.3.14 bun audit --prod --audit-level=high` | PASS: no vulnerabilities reported; published fixed Next version is established separately by the advisory and package checks |
| `bunx --package=bun@1.3.14 bun audit --audit-level=high` | FAIL, exit 1: same existing dev-only braces GHSA-vfj7-8cjw-p6xm; no new acceptance or suppression |
| `bunx --package=bun@1.3.14 bun run license:check` | PASS: 723 installed package versions approved |
| `bunx --package=bun@1.3.14 bun run quality:shape` | PASS within unchanged ratchet limits |
| `NEXT_DISABLE_SWC_BINARY=1 NEXT_CACHE_DIR="$PWD/.next-cache" bunx --package=bun@1.3.14 bun run build` | First attempt FAIL: nine Newsreader font query parsing errors. Identical second attempt PASS: Next 16.4.1, nine static pages, 31 script blocks and one style block externalized |
| `bunx --package=bun@1.3.14 bun run quality:bundle` | PASS; budgets unchanged |
| `bunx --package=bun@1.3.14 bun run test:csp` | PASS: three externalized bootstrap assets loaded under production CSP |
| `bunx --package=bun@1.3.14 bun run test:pwa` | FAIL, exit 1: Chromium lifecycle passed; same Firefox profile-launch failure stopped the sequential script before WebKit |
| `bunx --package=bun@1.3.14 bun run test:pwa -- webkit` | PASS: WebKit lifecycle |
| `bunx --package=bun@1.3.14 bun run test:e2e:export -- --workers=2` | FAIL, exit 1: 354 tests attempted; 227 passed, 126 failed, 1 existing skipped, zero retries/flakes; exact pre-upgrade outcome and failure fingerprints |
| `git diff --check` | PASS |

## Failure diagnosis and comparison

The first production-build attempt observed a font-loader failure not seen in the successful immediately preceding 16.3.8 baseline build. Next and its actual resolved native binding were both 16.4.1, and the additional `.next-cache` directory was empty. The error matched upstream [Next issue99114](https://github.com/vercel/next.js/issues/99114), which describes Google Fonts sometimes returning extensionless URLs with query parameters that the loader misparses. A fresh diagnostic Newsreader CSS response returned HTTP200 with nine conventional font URLs and no query-bearing URLs. The unchanged build then passed. This supports an intermittent upstream font-response issue; the exact CSS response from the failed build was not retained, so its cause is not conclusively proven. No font, bundler, cache policy, or application-source workaround was introduced. Retain this reliability issue separately from the passing retry.

Parsed every unexpected result in the new `playwright-report/export/index.html`:

- Chromium: **114 passed, 4 failed**. All four contain localhost:8090 feedback requests blocked by connect-src, exactly matching the pre-upgrade baseline.
- WebKit: **113 passed, 4 failed, 1 skipped**. All four failures have the same feedback/CSP fingerprint; no auth-token flakes.
- Firefox: **118 failed before app startup**. Every failure contains the same `Could not find profile folder` error as the pre-upgrade run.
- **Zero unmatched failures.** No CSP changes, disabled checks, added skips or advisory suppressions were used.

The actual 16.4.1 export's generated config still has `output=export`, `cacheComponents=false`, and `experimental.useCache=false`. No production or exploit probe was performed. The advisory remediation is the published patched framework version, with its bundled RSC implementation, rather than a root React override. Legitimate local behavior was exercised by the unit suite, export build, CSP/PWA smoke and 227 passing browser tests; complete browser release proof remains blocked by the failures above.

## Preservation evidence and remaining handoff

- Pre-upgrade manifest SHA-256: `4779bb289d308980b3c03d0590c1aa8a82a8535f71cb2e9aae1b1a81348a072f`; final: `a1f86c2f9a89fb2ef3d742095ceb7fb28fe584f22719b532540ff1e2245c5eb7`. Exact text comparison passed after substituting only the two requested pins.
- Pre-upgrade lock SHA-256: `4c91c14e2e0c0d3cac5b3ffe71232e2386452383bd715bcea6772340d01de4f2`; final: `60a9d96e85abad7f9ee40481d8f05595f0258b336b2d60874c87c2bbd26245fa`. Every unrelated parsed record and all unrelated metadata match the snapshot. `next-env.d.ts`, `tsconfig.json`, `public/sw.js`, and AGENTS.md remain unchanged.
- Full release validation is not green: baseline feedback/CSP tests, Firefox execution and the raw all-dependency braces audit still fail. The newly observed intermittent font-build failure also remains a reliability follow-up even though the unchanged retry passed.
- Upgrade is local only. No authorized branch, push, release or deployment was performed. Aikido's scanned commit remains unavailable; Aikido resolution requires an authorized source update and re-scan of that exact commit. Nothing was closed or suppressed in Aikido.
- The earlier applicability review and pre-upgrade validation below are historical baseline evidence; their no-upgrade disposition is superseded by this authorized upgrade.

# Session state, 2026-10-22: Next.js GHSA-673q-mjm6-r5xr applicability

## Resuming From Here

- Completed: exact advisory identification, local applicability investigation, two independent read-only reviews, repository documentation, and local verification. See `SECURITY.md`'s dated GHSA subsection.
- Disposition: affected package present; vulnerable Cache Components functionality not used/reachable in the reviewed supported static deployments. No dependency or runtime-code change justified under the owner's applicability-based scope. Upstream still recommends upgrading even without similar functions; 16.4.1 is the smallest patched Next release.
- Reviewed source: `main` at `479fc798a9287099bfe6b0fef50f504cfbc294e4`, plus the existing manifest/lockfile edits. Aikido issue 52751721's advisory ID was supplied by the owner; its scan commit remains unavailable.
- Next.js and eslint-config-next before/after: **16.3.8 -> 16.3.8** in manifests, lockfile and installed packages. Root React remains 19.3.0; Next's server-dom implementation is bundled separately.
- Preserved existing Stagehand/Playwright/transitive edits byte-for-byte: `package.json` SHA-256 `4779bb289d308980b3c03d0590c1aa8a82a8535f71cb2e9aae1b1a81348a072f`; `bun.lock` SHA-256 `4c91c14e2e0c0d3cac5b3ffe71232e2386452383bd715bcea6772340d01de4f2`.
- Only this task's `SECURITY.md` and `tasks/todo.md` edits remain for handoff. No branch, commit, push, PR, publication, deployment, credential/security-setting change, or advisory exception was made. Repository policy prohibits commits on main; the owner prohibited creating a branch.

## Local verification

Runtime: Node **22.22.3**. Installed global Bun was 1.4.2; checks below used the repository's **1.3.14** through `bunx --package=bun@1.3.14 bun`. Run from this checkout. Commands are shown exactly as invoked.

| Command | Result |
| --- | --- |
| `bunx --package=bun@1.3.14 bun install --frozen-lockfile` | PASS: 733 installs checked, no changes |
| `bunx --package=bun@1.3.14 bun lint` | PASS, no warnings |
| `bunx --package=bun@1.3.14 bun typecheck` | PASS |
| `bunx --package=bun@1.3.14 bun run test -- --coverage` | PASS: 3,515 tests passed, 1 existing skipped; 271 files passed, 1 skipped; statements 89.93%, branches 84.02%, functions 90.07%, lines 91.05% |
| `bunx --package=bun@1.3.14 bun audit --prod --audit-level=high` | PASS: no vulnerabilities reported by this audit database; does not prove Aikido resolution |
| `bunx --package=bun@1.3.14 bun audit --audit-level=high` | FAIL, exit 1: existing dev-only braces GHSA-vfj7-8cjw-p6xm; no Next advisory returned; existing acceptance policy was not changed |
| `bunx --package=bun@1.3.14 bun run quality:shape` | PASS within existing ratchet limits |
| `bunx --package=bun@1.3.14 bun run license:check` | PASS: 723 installed package versions approved |
| `NEXT_DISABLE_SWC_BINARY=1 NEXT_CACHE_DIR="$PWD/.next-cache" bunx --package=bun@1.3.14 bun run build` | PASS: Next 16.3.8; nine static pages generated; 21 executable script blocks and one style block externalized; generated export worker stamped 13.9.6 (tracked app version remains 13.9.5) |
| `bunx --package=bun@1.3.14 bun run quality:bundle` | PASS |
| `bunx --package=bun@1.3.14 bun run test:csp` | PASS: Chromium boot under production CSP, two externalized assets loaded |
| `bunx --package=bun@1.3.14 bun run test:pwa` | FAIL, exit 1: Chromium lifecycle passed, Firefox failed before app startup with `Could not find profile folder`; this sequential command did not reach WebKit |
| `bunx --package=bun@1.3.14 bun run test:pwa -- webkit` | PASS: WebKit lifecycle |
| `bunx --package=bun@1.3.14 bun run test:e2e:export -- --workers=2` | FAIL, exit 1: 354 tests attempted; 227 passed, 126 failed, 1 existing skipped, zero retries/flakes |
| `git diff --check` | PASS |

Toolchain setup attempt `npx --yes --package=bun@1.3.14 -- bun --version` failed with npm `EOVERRIDE` for the repository's nanoid override. Using Bun's own pinned launcher succeeded without changing manifests or lockfile. Two isolated Firefox persistent-context launches reproduced the profile error using newly created, verified-existing directories in the OS temporary directory and `.next-cache`; both directories were cleaned up.

Loading Next's production-build config returned `output=export`, `cacheComponents=false`, `experimental.useCache=false`; `.next/required-server-files.json` from the actual build contains the same values. Source searches found no cache directives or `next/cache` imports. All generated route entries are pages, with no request-time API handlers. No exploit PoC or production request was attempted. No regression test was added for this documentation-only disposition; existing build, unit and browser checks exercised unchanged behavior.

## Browser failures and baseline comparison

The HTML report at `playwright-report/export/index.html` records:

- Chromium: **114 passed, 4 failed**, all four in feedback.spec.ts. Each failure contains localhost:8090 feedback requests blocked by `connect-src`, matching the inspected main CI baseline at https://github.com/vscarpenter/gsd-task-manager/actions/runs/39721986279.
- WebKit: **113 passed, 4 failed, 1 skipped**. The four failures have the same feedback/CSP fingerprint. The two auth-token flakes seen in that CI run did not recur locally.
- Firefox: **118 failed before app startup**. Every failure has the browser profile-launch fingerprint; these are additional local environment failures, not the known feedback baseline. macOS is 27.0.1; the symptom matches upstream https://github.com/microsoft/playwright/issues/42768 and https://bugzilla.mozilla.org/show_bug.cgi?id=2062988, but this run did not establish the OS-level root cause.
- Parsed every unexpected result in the generated report: 118 Firefox launch errors and eight feedback/CSP errors; **zero unmatched failures**. No CSP relaxation, skips, disabled checks or test suppressions were introduced.

## Remaining handoff

- The reviewed vulnerability has no reachable path under current supported configuration; the installed package version is still in the advisory range. Reassess if Cache Components, cache directives, custom handlers or server hosting are introduced. A package-only re-scan can continue to flag 16.3.8.
- Browser release validation is not green: resolve the feedback harness/CSP-origin mismatch without weakening the policy, and restore Firefox execution through a separately authorized environment/tooling fix or supported CI runner. The all-dependency braces advisory also remains.
- Production infrastructure and deployed source were not inspected. No deployment is required for this documentation-only change, and none is authorized. Any future patched dependency release requires its own review/release/deployment handoff.
- Give the applicability evidence to the Aikido owner for review and a scan of the exact intended commit. This task did not close, suppress or confirm resolution of the Aikido issue.

# Session state, 2026-10-21: bun audit advisories (`chore/deps-audit-2026-10-21`, PR #613)

## Resuming From Here

`bun audit` reported 10 advisories (3 high, 7 moderate) in four packages. PR #612, opened
that morning, already moved the MCP SDK to 1.32.1. This branch stacks on #612 and clears
the rest, so merging #613 covers #612.

- [x] Vitest: root 5.0.2 to 5.0.5, MCP 4.1.11 to 4.1.12 (`7108dcb`). The hardening guard
      now pins the root runner too. Coverage totals and the 281-file key set match 5.0.2.
- [x] Hono: the exact override moves from 4.13.7 to 4.13.13 (`5eca4c4`).
- [x] Verified in a clean worktree on bun 1.3.14 and Node 22.19: every CI job's command,
      the CI audit checker, `next build`, and a stdio probe of the built MCP server.
- [ ] CI on PR #613, then Vinny merges it and closes #612.
- [x] Release `gsd-mcp-server` 1.3.1 (published 2026-10-23 from `mcp-v1.3.1`). The published 1.3.0 pins SDK 1.31.0 exactly, so npm
      users keep the vulnerable SDK until then.

Left alone on purpose: `braces` 3.0.3 has no patched release and stays accepted until
2027-01-05. The e2e jobs have been red on main since #609 (2026-10-17). Vinny's uncommitted
stagehand 4.2.1 and playwright 1.64.1 bump in the main checkout was not touched.

# Session state, 2026-10-17: full e2e suite on the production export in CI (`ci/e2e-on-export`)

## Resuming From Here

CI wall time was 9 to 13 minutes, set by three e2e legs that ran 118 tests at 1 worker on
`next dev --webpack` and then reran 29 of them on the export. Vinny chose to run every spec
on the export with 2 workers and drop the dev-server pass from CI. Spec: the 2026-10-17
section at the end of `tasks/spec.md`.

- [x] Red, then green, one cycle each: AC1 (no `testMatch` in `playwright.export.config.ts`,
      `tests/e2e/export-journeys.ts` deleted), AC2 (`workers: process.env.CI ? 2`), AC3 (no
      `bun run test:e2e --` in `ci.yml`). AC6 guards the required job names. All 8 workflow
      guard files pass (75 tests).
- [x] AC7: the first full run on the export found three harness problems, none in the app.
      The export server sent `__next.*.txt` RSC payloads as `application/octet-stream`, so
      every client navigation became a full page load (fixed: `.txt` is `text/plain`, as on
      S3). `production-hybrid.spec.ts` pressed Alt+N before `/dashboard` committed (fixed: a
      URL wait). WebKit reports a prefetch that a test's `page.goto` cancels as an uncaught
      error (fixed: a narrow fixture fingerprint, matched on the stack's first line). Details
      in the spec's same-day amendment.
- [x] Verified: both fixed specs 225 of 225 with no retries; the full suite passes in
      Chromium (118, 42 s), Firefox (117 + 1 skip, 53 s), and WebKit (117 + 1 skip, 55 s)
      with no flakes, locally with 2 workers. Gates: 3,511 unit tests with coverage,
      typecheck, lint, knip, and code shape 126 all clean. `CLAUDE.md:89` updated.
- [ ] Push and open the PR (needs Vinny's go-ahead), then check AC8 against the CI baseline:
      no e2e leg over 6 minutes, and wall time under 9 minutes.

Open for Vinny: the WebKit fingerprint relaxes the shared fixture narrowly. The default
taken is to keep it (it matches the Firefox aborted-font precedent).

Not in this branch: Vinny's uncommitted `package.json` and `bun.lock` (Playwright 1.64.1 and
Stagehand 4.2.1 bumps) ride along unstaged. No version bump; releases are separate PRs.


## Resuming From Here

Archiving deletes each task's server copy. `useAutoArchive` ran `archiveOldTasks` on mount and
hourly from local Dexie even with sync on, so a page load before the first pull, or a tab that
sat in the background, could archive a task another device had reopened, and the queued delete
removed it everywhere. B-46 in the GSD Project backlog (web half; Android still open).

- [x] Red: `onPulled` cases in `tests/sync/sync-coordinator.test.ts` (fires after `success` and
      `partial`, not after `error` or `cancelled`, unsubscribes, a failing listener is isolated)
      and a "with sync on" block in `tests/data/use-auto-archive.test.ts`. Against the old hook,
      four failed: it archived on mount, never listened for pulls, and never unsubscribed.
- [x] Green: `SyncCoordinator.onPulled` notifies after a completed pull. The hook purges trash on
      mount and hourly as before; it archives on mount and hourly only with sync off (an
      unreadable sync state counts as on). With sync on it archives after a pull, at most once
      an hour, and a disabled setting doesn't use up the hour.
- [x] Test fix: two older interval tests restored their `setInterval`/`clearInterval` spies after
      `useRealTimers()`, which put the fake timer back on `global`. Every later `waitFor` in the
      file then checked once and timed out. Restoring the spy first fixed it.
- [x] `pb-sync-reviewer`: nothing blocking. Mutation-checked the four tests added after its pass.
- [x] Codex P1 on PR #603 (also B-47): a completed pull doesn't prove local matches server. The
      `>=` cursor minus 30s can miss a record another device pushes later with an older stamp,
      and an edit can land between the pull and the archive. The push delete guard now also
      skips an archive's delete when the remote is newer than the archived payload's
      `updatedAt` (`isStaleDelete` in `lib/sync/pb-push.ts`). Manual deletes carry no payload
      and are unchanged. Red first in `tests/data/sync/pb-push.test.ts`.

Local gates: 3,480 passed, 1 skipped (sqlite3 installed so `tests/docker-migrations.test.ts`
ran). Typecheck, lint, knip, and shape clean.

Follow-ups, not in this PR:
- B-48: `fullSync` can report `success` when push is authenticated but pull isn't, and records
  that fail mapping are only logged. Codex raised it as a P1; the delete guard above now keeps
  either from deleting a newer task, so what's left is status accuracy. Waiting on the owner.
- Signed-in users with auto-sync off now archive only after a manual Sync. Safe, but a settings
  hint might help. "Archive now" in Settings still calls `archiveOldTasks` directly.

# Session state, 2026-10-12 (late): editing turned off a default reminder (`fix/editor-keeps-default-reminder`)

## Resuming From Here

A task with reminders on but no `notifyBefore` of its own follows the default from Settings;
the capture bar creates every task that way. The editor showed its Reminder field as Off, and
any save sent `notificationEnabled: false`, so editing a title quietly turned the reminder off.
B-41 in the GSD Project backlog, found by `pb-sync-reviewer` during B-02; reproduced in the
running app before the fix.

- [x] Red: four cases in `tests/ui/edit-drawer-reminder.test.tsx`: show the built-in default,
      show the default chosen in Settings, keep a default reminder on through an untouched save,
      and keep a disabled reminder's stored offset through an untouched save. All four failed.
- [x] Green: the Reminder field now tracks the user's pick separately and stays untouched until
      clicked. Untouched, it shows what the checker will fire (`notifyBefore ?? defaultReminder`)
      and saves the stored pair back as is. This matches the iOS editor. The default comes from
      the new read-only `useDefaultReminder` hook. Create mode is unchanged (starts at Off).
- [x] Live check in Chromium (America/Chicago), title-only edit then save: on `main` the field
      read Off and the save stored `notificationEnabled: false`; on the branch it read 15m and
      the reminder stayed on, still following the default.

Local gates: 3,457 passed, 1 skipped; `tests/docker-migrations.test.ts` couldn't run without the
sqlite3 CLI. Typecheck, lint, knip, and shape clean (the first try grew `useEditDraftState` from
53 to 55 lines; moving the reminder wiring into `useDetailDraftFields` brought it to 52). Not pushed.

Still open from B-41: if PocketBase stores a null `notify_before` as 0, other clients read a
default-following task as "at time of event". Needs a check against a real server.

# Session state, 2026-10-12 (evening): cleared editor fields didn't save (`fix/editor-clears-fields`)

## Resuming From Here

Choosing None for the due date or emptying Estimate in the edit drawer saved nothing: the
editor sends the key as `undefined`, and `mergeTaskUpdates` used `??`, which kept the old value.
B-02 in the GSD Project backlog; reproduced in the running app before the fix.

- [x] Red: `tests/data/tasks/update-clear-fields.test.ts` on the real fake-indexeddb, using the
      exact draft shape the editor submits. Four failed, each keeping the old value; the guard
      test (absent keys keep their values) passed.
- [x] Green: `dueDate`, `notifyBefore`, and `estimatedMinutes` now merge by key presence, so a
      present `undefined` clears and an absent key keeps. `updateTask` has one app caller (the
      editor), so no other path changes.
- [x] Review by `pb-sync-reviewer`: nothing blocking. Took two of its four notes: a cleared due
      date now also drops the old snooze and sent flag (it already did for a changed date), and
      the sync test asserts an `update` was queued and maps to `due_date: ''`.
- [x] Live check in Chromium (America/Chicago): on `main` the date and the 45-minute estimate
      survived None and an empty field; on the branch both cleared and the reminder stayed.

Local gates: 3,453 passed, 1 skipped; `tests/docker-migrations.test.ts` couldn't run without the
sqlite3 CLI. Typecheck, lint, shape (30 and 92, unchanged), and knip clean. Not pushed.

Found along the way, not fixed here:
- A task with reminders on but no stored `notifyBefore` (the capture bar's default) shows Off
  in the editor, and any save turns its reminder off (`use-edit-draft-state.ts:118-121, 232`).
- A cleared estimate may reach other devices as `estimated_minutes: 0` if PocketBase stores
  null numbers as 0. The schema already reads 0 as no estimate, so nothing visible changes.

# Session state, 2026-10-12: the editor moved untouched due dates (`fix/editor-keeps-due-date`)

## Resuming From Here

The edit drawer turned an existing due date back into a preset on every save. A date 1–7 days out
became this Friday, one 8–14 days out became next Monday (sometimes earlier than the real date), and
any time of day dropped to local midnight. "Today" came from the UTC date. Found in the 2026-10-12
cross-platform parity audit (B-01 in the GSD Project backlog) and reproduced in the running app.

- [x] Red: `tests/ui/edit-drawer-due-date.test.tsx`, nine cases built in local time. Six failed in
      UTC and seven in America/Chicago, each for the predicted reason.
- [x] Green: `classifyExistingDate` matches a preset only on that preset's own day, and a pick on
      the stored date's day returns the stored ISO untouched. New `localDayOf` in
      `lib/due-date-presets.ts`.
- [x] Live check in Chromium (America/Chicago), title-only edit then save: on `main` all three
      seeded dates moved; on the branch all three kept their date and time. No page errors.

Local gates: 3,447 passed, 1 skipped; `tests/docker-migrations.test.ts` couldn't run without the
sqlite3 CLI. Typecheck, lint, shape (30 and 92, unchanged), and knip clean. Not pushed.

Still open:
- B-02: choosing None or emptying Estimate keeps the old value (`mergeTaskUpdates` uses `??`).
- "submits the custom-picked date" in `tests/ui/edit-drawer.test.tsx` fails east of UTC
  (Asia/Tokyo) because it compares `dueDate.slice(0, 10)`, the UTC day. It failed before this
  change too.

# Session state, 2026-10-09: review comments on PR #595 (`fix/review-do-first-soon`)

## Resuming From Here

Five open threads triaged against `ccf86a1`. Four were real and one was a false positive.
Fixed test-first in five local commits, not pushed:

- [x] `bdf9908` capture bar keeps text and a chosen quadrant typed during a pending save (Codex).
- [x] `63bc91a` matrix toggle returns the `handleToggle` promise, so the busy guard holds (Claude).
- [x] `2fac083` import Replace card names the settings rows the file carries (Codex).
- [x] `4663953` cursor docs say "clamp to now" in the sync rule and the trust-boundaries table (Claude).
- [x] `0768b95` reset dialog: false positive, pinned with a test. The dialog derives its first row
      from live active plus completed and never receives `storage.totalTasks` (Codex).
- [x] Pushed `ccf86a1..3d5d083`, replied in all five threads, and resolved them (Vinny approved).
- [x] CI green on `3d5d083` in all three browsers; Vinny merged PR #595 as `99718b4`.

The PR's CI was already red at `ccf86a1` (e2e and lint). Vinny approved fixing both here:
- [x] `d5a6a40` first-visit flag. Three causes: `public/theme-init.js` wrote the flag before its
      redirect; `FirstTimeRedirect` compared `"/about"` while the trailing-slash export reports
      `"/about/"`; a tap on Open App before hydration is a full load that the pre-bundle redirect
      bounced back. Fix is a per-tab `gsd-seen-about` session-storage marker shared by both.
      Redirect and about specs: 24 of 24 with `--repeat-each=4` in three browsers.
- [x] `f68da60` import dialog split (174 to 83 lines); `getTooltip` and `DrawerFooter` brought back
      under the limits so violation counts stay at the ledger's 30 and 92.
- [x] `3d5d083` shape baseline records 12 grown maxima; `code-shape-debt.json` is untouched because
      its policy says exceptions may only decrease.

Local gates on `3d5d083`: root 3,445 passed, 1 skipped; typecheck, lint, shape, and knip clean.

`bun.lock` carries an unrelated uncommitted change; left alone.

# Session state, 2026-10-08: modernization Phase 5, bundle E (one sync-status store)

Spec: `tasks/spec-phase5-restructure.md`, bundle E. Approved design: brief §3 Phase 5, exit
criterion 4. Five stacked branches cut in order from `main` @ `9b4f9fb`, each from the previous
tip, so the PRs merge in order and E5's tip is the integration tree.

- [x] E1 `refactor/sync-status-1-log-polls` (`3ecb3f6`, review fix `bdabb23`): every status poll
      runs through `guardPoll`, which logs a failed read under `SYNC_STATUS` and keeps the last
      value.
- [x] E2 `refactor/sync-status-2-drop-health-timer` (`4b14219`): the health monitor's own timer,
      whose report nobody read, is gone with `start`, `stop`, and `isActive`.
- [x] E3 `refactor/sync-status-3-store` (`1d0ce74`, review fix `637801a`):
      `lib/sync/sync-status-store.ts` behind `useSyncExternalStore`, started once by
      `SyncProvider`; the reducer split drops the provider's complexity exception (130 to 129).
- [x] E4 `refactor/sync-status-4-hooks` (`1b2dfe9`, review fix `cd26d79`): the store polls the
      pending count; both `useSyncStatus` hooks read the store and share `useRetryCountdown`;
      both hooks lose their length exception (129 to 127).
- [x] E5 `refactor/sync-status-5-health-merge` (`5dcbab4`, review fix `7feb2d0`): one health
      poll on the sync button's schedule; `useSyncHealth` turns each report into toasts with the
      same cooldown and id; the provider's own check goes (127 to 126).
- [ ] Push and PR E1 to E5 in order: waits for Vinny. Merge E1 first and work down.
- [ ] F. `MatrixSimplified` extractions, one per PR
- [ ] G. small burn-downs
- [ ] H. final ratchet and exit boxes

Each PR passed its gates (root suite, MCP, typecheck, lint, shape, scrubbed build with a clean
tree; E4 and E5 also 84 export journeys in three browsers and a look at the built app), had an
adversarial review with every finding fixed in a follow-up commit, and had a mutation probe that
reversed its change one line at a time (E2 2 of 2, E3 13 of 13, E4 12 of 12, E5 15 of 16 with one
equivalent mutant). On `7feb2d0`: root 3,412 passed, 1 skipped; shape 126 with ledger ceilings
30/4/0/92; knip clean; sync code down to 7 `setInterval` call sites from 12.

Named in the commits, inside the spec's wording: the header shows a finished sync within 500 ms
instead of up to 5 s; the health check also runs at the 5 min mark and no longer at 1 s; a
remounted sync button waits for the store's next check instead of running its own, and ignores
reports from before it mounted. The §7 "Synced" tooltip item stays unticked.

Open for Vinny: push and PRs; `enableSync` in `lib/sync/config/enable.ts` has no production
caller (dead-export follow-up); the three §7 items from the Phase 5 mapping stay unticked.
Playwright 1.64 browser builds were installed on 2026-10-08 with Vinny's OK.

Blockers: none. Full handoff: `../gsd-modernize/HANDOFF.md`.

# Session state, 2026-10-07: modernization Phase 5, restructure and burn down code shape

Spec: `tasks/spec-phase5-restructure.md`. Approved design: brief §3 Phase 5. Both entry boxes are
ticked, and the baseline is in `../gsd-modernize/analysis/gsd-taskmanager/BASELINE.md` (measured
code shape 133 at `d4baa2d`; the ledger's ceilings total 153). Branches are cut from `main` @
`d4baa2d`, one per bundle.

- [x] Baseline recorded, entry boxes ticked, and three new §7 items added unticked (CSP drift,
      the missing "Synced" tooltip, the off-by-one build version).
- [x] A. stamp the cache version into `out/sw.js`, `chore/stamp-sw-version-in-out` (`f34a5b7`,
      review fixes `ee58dae`). A local build now leaves the tree clean.
- [x] B. generate `public/sw-cache-logic.js`, `chore/generate-sw-cache-logic`, stacked on A
      (`6f6193c`, review fixes `5ff7651`). The deployed worker updates once.
- [x] C. one CSP source, `refactor/csp-single-source` (`576d2b7`, review fixes `7021d11`). The
      CloudFront JSON and Caddyfile are byte-identical, so no infra deploy fires.
- [x] D. dead code and knip, `chore/knip-dead-exports` (`429f6ab`, `13e0a15`, `25938e6`). Code
      shape 133 to 130. knip checks unused files and dependencies only (see below).
- [x] Push and PR A to D plus this spec: merged by Vinny on 2026-10-07 as #585 to #589.
- [x] E. one sync-status store, five PRs (built 2026-10-08; see the block above)
- [ ] F. `MatrixSimplified` extractions, one per PR
- [ ] G. small burn-downs
- [ ] H. final ratchet and exit boxes

Each bundle passed its own gates and an adversarial review, and every review finding was fixed.
All five branches merged together cleanly in a scratch clone: root 3,392 passed with coverage
89.4/83.3/89.7/90.6, MCP 348, typecheck, lint, shape (130), knip, a build that left the tree
clean, PWA in three browsers, CSP, and export journeys 84/84.

Open for Vinny, defaults taken: knip runs on files and dependencies only. Production mode also
reports 216 unused exports and 50 types, about 139 of them exports only tests call; that
cleanup, widening knip past production files, and moving the RULE-265 pins off `exportTasks` are
follow-ups. The three new §7 items stay unticked, so they keep today's behavior.

# Resuming From Here, 2026-10-07: modernization Phase 3 signed off

- [x] All four Phase 3 exit boxes in the brief are ticked with evidence. Each of the 15 fixes was
      reversed on `main` @ `a1d3444` with the tests kept, and every item had a test fail on the
      pre-fix code. Table: `../gsd-modernize/analysis/gsd-taskmanager/CONTRACT_MAP.md`.
- [x] `8d385ce` (a structured 429 or 5xx is transient) missed #579 because it was never pushed.
      It landed as #583 (`bb5c42a`). All 15 PR checks passed, and so did `main`'s runs.
- [ ] Next: record the code-shape counts in `BASELINE.md`, then start Phase 5. The ratchet
      expires 2026-12-31. Phase 4 waits on Vinny's §7 decisions.
- [ ] Cleanup, needs Vinny's OK: the four agent worktrees, the bundle and `worktree-agent-*`
      branches, `fix/phase-3-defects` (now fully merged), and the remote branch
      `fix/sync-structured-5xx-transient`.

Blockers: none. Full handoff: `../gsd-modernize/HANDOFF.md`.

# Resuming From Here, 2026-10-06: 13.8.0 release and gsd-mcp-server 1.3.0

- [x] Local sign-in on `dev.local:8080` timed out by design: since #569 the hosted bounce
      returns only to gsd.vinny.dev. Google sign-in verified on production.
- [x] Web 13.8.0: PR #581, tag `v13.8.0`. The release run failed its audit on
      GHSA-6qxp-vccf-f47h, so Vinny deployed locally. Prod `sw.js` reads 13.8.1 and serves
      13.8.0 code, but that build has no attestation.
- [x] MCP SDK 1.30.1 to 1.31.0 and gsd-mcp-server 1.3.0: PR #582 (`a1d3444`), tag
      `mcp-v1.3.0`, run 37531982567. On npm since 21:21 UTC with provenance; `latest` is 1.3.0.
- [ ] Optional: cut the next web tag so production returns to a gated, attested build.
      `v13.8.0` can't re-run green because its commit still pins SDK 1.30.1.
- [ ] Later: SDK 1.32.x as its own change (it accepts `tools/call` without arguments).
- [ ] The `braces` audit exception expires 2027-01-05.

Blockers: none. Assumption: 1.3.0 (not 1.2.9) because `list_devices` left the tool surface.

# Session state, 2026-10-06: modernization Phase 3, fix the ticked defects

Spec: `tasks/spec-phase3-defects.md`. Approved design: brief §3 Phase 3, with
Vinny's §7 decisions of 2026-10-06 (production stays on the bare PocketBase
binary; extract-rules skipped; 11 revisions accepted; 15 items to fix, 4 kept;
`list_devices` removed). Branches are cut from `main` @ `53418f1`, one per bundle.

- [x] Recorded the §7 decisions in the brief; unticked the four Phase 3 exit boxes Vinny
      ticked early (his request); ticked SEC-002's Phase 2 exit box under the accepted revision.
- [x] A. completion metrics, `fix/completion-date-metrics` (Claude)
- [x] B. reminders, `fix/app-level-reminders` (Claude)
- [x] C. MCP correctness and `list_devices` removal, `fix/mcp-write-correctness` (worker)
- [x] D. sync, RULE-194 and RULE-192, `fix/sync-realtime-and-deletion` (Claude)
- [x] E. agent skills, OpenAPI, About snippet, `fix/agent-facing-docs` (worker)
- [x] F. self-host fresh migrations, `fix/self-host-fresh-migrations` (worker)
- [x] G. export message and trash cutoff, `fix/export-and-trash-hardening` (worker)
- [x] All 19 bundle commits stacked on `fix/phase-3-defects` (no conflicts), plus 6 review
      follow-ups. Reviews: a11y clean; pb-sync 0 blocking; adversarial A+B, C+E, F+G found one
      real bug (an unparseable `completed_at` crashed the dashboard) and three tests that passed on
      the old code; all fixed and re-probed against the pre-fix source.
- [x] Final verification on `fix/phase-3-defects`: root 3,435, MCP `test:coverage` 348, typecheck,
      lint, shape, scrubbed build, `quality:bundle`, export journeys 28/28, PocketBase system 6/6.
      Headless check on the built app: dashboard counts and streak, About snippet, and a reminder
      fired and marked on `/dashboard` in full headless Chrome.
- [x] `CONTRACT_MAP.md` rows and a Phase 3 section; `RULE_REVIEWS.json` notes, `.md` regenerated.
- [x] Push and PR: #579 merged 2026-10-06 as `bbdbd88`. The four exit boxes were ticked on
      2026-10-07, after #583 landed the missing commit (see the block above).

Watch on first CI run: `tests/docker-migrations.test.ts` now requires the sqlite3 CLI (it ships on
`ubuntu-24.04`). `/auth/callback` sits 4.4 KB over its recorded first-load size, inside the
5,120-byte allowance, because the app-level timers added about 3.6 KB to every route.

Follow-ups, not this phase: the MCP delete still reads then deletes with no re-read (pre-existing);
update and bulk preflights still compare raw `client_updated_at`, so a blank-stamp record edited by
a non-stamping writer slips through (Phase 4); `lib/archive.ts` and the v15 migration still compare
ISO strings; `navigator.serviceWorker.ready` can hang the checker with no service worker; the
pocketbase-system test still orphans `next dev`; the agent worktrees under `.claude/worktrees/` and
the eight bundle and `worktree-agent-*` branches can go once the PR merges.

Open for Vinny, not blocking: Phase 1's service-worker `Proposed revision:` line.

---

# Session state, 2026-10-05 (evening): modernization Phase 2, security findings

Spec: `tasks/spec-phase2-security.md`. Approved design: brief §3 Phase 2, with
the owner's §7 decisions of 2026-10-05 (sign out everywhere as an explicit
action only, no rotation on account switch; self-host image only; Claude edits
the ruleset).
Branches are cut from `main` @ `5df1fd7`, one per finding.

- [x] SEC-025: PocketBase 0.40.4 in the self-host image, branch `chore/pocketbase-0-40-4` @ `c490af0`.
      System tests 5/5 on 0.40.4 locally; all gates green. Not pushed.
- [x] SEC-002: "Sign out of all devices", branch `feat/sign-out-everywhere` @ `3dc77ff`.
      Owner's second answer: no automatic rotation on account switch; the cross-account error
      points to the action. Hook test, client test (8), UI tests (51), and a system test that
      fails without the route; browser check passed for the 404 and 204 outcomes.
      Deviation: the logout flow moved unchanged into `components/sync/use-logout.ts` so
      `useSyncAuthDialog` stays under its code-shape baseline (it shrank, 96 -> 95 violations).
      Review fixes taken: local-cleanup failure after a revoke, a 401 on an unexpired token,
      `saveNoValidate`, focus to Cancel and back to the trigger, `role="alert"` errors.
- [x] SEC-011: task logs carry ids only; error-logger masks through logger, branch `fix/redact-task-content-logs` @ `5395078`
- [x] SEC-027: `**/.env`, `**/.env.*`, and a root-only `.*` in `.dockerignore`, branch `chore/dockerignore-nested-env` @ `f4b98ce`
- [x] SEC-028: `next` and `eslint-config-next` to 16.3.8, branch `chore/next-16-3-8` @ `e1cf427` (scrubbed build,
      bundle budget, 28/28 export journeys)
- [x] SEC-030: audit before every deploy and publish, branch `ci/audit-before-deploy` @ `2efecfd`; `audit` added to
      `main-protection` required checks via gh api (owner approved)
- [x] Verified each branch and all six merged: root 3,384, MCP 331, typecheck, lint, shape; PocketBase system
      tests 6/6 on 0.40.4 with the revoke hook.
- [x] Pushed all six branches 2026-10-06; the owner asked for one PR, so the six commits are stacked on
      `fix/phase-2-security-findings` (byte-identical to the verified merge).
- [x] PR #578 merged 2026-10-06 as `53418f1` (tree identical to the PR head). On `main`, the new
      "Security audit / audit" job ran inside publish-docker before `publish`, so SEC-030 works.
- [x] All 14 checks on `main` `53418f1` passed. Brief: five of six Phase 2 exit boxes ticked with evidence;
      SEC-002 left unticked with a note, pending the owner's acceptance of its Proposed revision.
- [x] Owner approved 2026-10-06: deleted the six single-finding branches (local and origin) and
      `origin/fix/phase-2-security-findings` after re-verifying each against `main`. Only `main` remains.
- [ ] Phase 3: owner ticks §7. Review delivered 2026-10-06: 15 to fix (4 low priority or optional),
      4 keep, 2 belong in Phase 4; seven proposed PR bundles, streaks first. With the owner's OK the
      brief's §7 now carries 10 Proposed revision lines, 4 notes, and a new Phase 4 item (an unset
      notify_before is stored as 0). Also still open: the extract-rules skip (recommend skip).

Follow-up found (not this phase): `pocketbase-system.test.ts` spawns `bun run dev:e2e` and
kills only the bun process, so `next dev` survives as an orphan and rewrites
`next-env.d.ts` and `tsconfig.json`. Kill the process group (`detached: true`, then
`process.kill(-pid)`). Locally, stop the orphan and `git restore` both files after each run.

---

# Session state, 2026-10-05: modernization Phase 1, pin the hand-kept copies

Spec: `tasks/spec-phase1-pin-copies.md`. Approved design:
`../gsd-modernize/analysis/gsd-taskmanager/MODERNIZATION_BRIEF.md` §3 Phase 1.
Non-trivial tier. Branches are cut from `main` @ `22b83ee`, one per unit. This
file and the spec stayed uncommitted during Phase 1, because the owner's done
criterion was that `git diff main --stat` shows only test and fixture files.
They ride with the next branch, `chore/source-map-js-audit`.

- [x] Pilot: field limits, branch `test/pin-field-limits` @ `e3e934e`. Probe 10/10.
- [x] PocketBase record shape, branch `test/pin-pb-record-shape` @ `457ee75`. Probe 14/14.
- [x] Completion metrics and streaks, branch `test/pin-completion-metrics` @ `e4c626b`. Probe 17/17.
- [x] Service-worker cache rules, branch `test/pin-sw-cache-rules` @ `80489c5`. The existing
      test caught 28/54 single-copy edits; with the new case table, 54/54.
- [x] P0 map: six rules had no pin for their main outcome (002, 003, 093, 191, 265, 272).
      Branch `test/pin-p0-contract` @ `36c5846`. Probe 16/16; existing pins 45/45.
- [x] Verified: both suites, typecheck, and lint green on each branch alone and on all five
      merged (root 3,357 tests, MCP 331). Diffs are test and fixture files only.
      Cross-platform fixtures match gsd-iosapp and gsd-android by SHA-256.
- [x] `CONTRACT_MAP.md` written; brief Phase 1 boxes ticked; one Proposed revision line.
- [x] Handoff: lessons appended to `tasks/lessons.md`.

## Resuming From Here

Done: Phase 1 is built and verified on five branches, one commit each, cut from
`main` @ `22b83ee`, pushed 2026-10-05 as PRs #572 (pilot, `test/pin-field-limits`),
#573 (record shape), #574 (metrics), #575 (service worker), and #576 (P0 pins).
`CONTRACT_MAP.md` and the brief ticks live in
`../gsd-modernize/analysis/gsd-taskmanager/`. The owner deleted the `GH_API`
token; GitHub's `/user` returned 401 for it, and both brief boxes are ticked.

All five merged 2026-10-05, pilot first (#572 = `50a6f0d`, then up to `e4d44c7`).
Local branches cleaned up. Merged `main` passes both suites (root 3,357, MCP 331),
typecheck, and lint.

Audit fix: `main` went red on the Security Audit workflow (GHSA-68fv-2mgg-jv7q,
`source-map-js` below 1.2.2). Branch `chore/source-map-js-audit` adds an
`overrides` floor of `>=1.2.2`, the guard-test pin, and the lockfile bump, made
with bun 1.3.14. The audit checker and the production audit pass locally.

Next: push the chore branch and open its PR once the owner says so. Then Phase 2
(its entry criteria are met: Phase 1 merged, `GH_API` revoked), which first needs
the owner's SEC-002 choice of per-device or all-device sign-out.

Blocked: nothing. The shell still exports the dead `GH_API` value from somewhere
outside the common profile files; the owner may want to remove it.

Assumptions: this file, the spec, and the lessons addition stay uncommitted, so
every branch diff stays test-only. Commit them on a docs branch if wanted.

Pilot findings for the brief (reported to the owner, not edited into §7):
1. MCP writes `notify_before` 0 where the web writes null, so an MCP edit moves a
   web task's reminder to its due time. Pinned in `pb-record-shape.json`.
2. More hand-kept copies: the estimate limit (1 to 10080) as literals in
   `lib/schema.ts` and two MCP files; the 32-character key check in five places;
   the export messages in `settings-body.tsx` and `backup-download.ts`.
3. The SW pair has no MCP side, hence the Proposed revision on exit criterion 2.
4. RULE-270's card contradicts the code on unparseable remote timestamps.

---

# Session state, 2026-09-30: dependency update repair

Branch `chore/deps-update-2026-09-30`, cut from `main` @ `a0c5b48`, carrying the
owner's uncommitted update. Standard tier: the red guard tests are the failing
tests, and the fixes are pins, two workflow files, and one regex.

Diagnosis: `main` was red before the update. PR #565 added `claude.yml` and
`claude-code-review.yml` without top-level `permissions` or explicit
`persist-credentials` (fails `pipeline-workflows.test.ts`, which reds `test` and
`SonarCloud`), and `undici@7.29.0` picked up two high advisories (reds `audit`).
The update then tripped five more guard tests.

- [x] Workflows rebuilt as HEAD plus the new action pins. A YAML formatter had
      rewritten `[a, b]` as `[ a, b ]`, which broke two text guards. All 13 new
      action SHAs match their tags. `SETUP_NODE_22` in `build-config.test.ts`
      now expects `# v7`.
- [x] Claude workflows: top-level `permissions: contents: read` and
      `persist-credentials: false`. claude-code-action replaces the checkout
      credential with its own token (`replaceCheckoutCredentials` in its
      `git-config.ts`), so it does not need the stored one.
- [x] Overrides: `packageManager` held at bun 1.3.14. `undici` 7.29.1,
      `fast-uri` 4.1.5, `ip-address` 10.7.2. Guard pins updated in the same
      commit. `bun audit` went from 16 advisories (2 high) to none.
- [x] Verified in a clean worktree on bun 1.3.14 and Node 22 with
      `bun install --frozen-lockfile`: 3,177 tests passed, 1 skipped; coverage
      89/83/89/90; typecheck, lint, shape, license, audit, build, bundle budget,
      CSP smoke, MCP coverage (308 passed), and 28 of 28 export journeys on
      Chromium.

## Resuming From Here

Done: pushed and opened as PR #568. The version trio is at 13.6.1
(`5cec9af`), bumped at the owner's request.

Next: merge #568 once its checks pass. It turns `main` green again, so it
should merge before other work.

Open decisions, each with the default this branch took:

1. Bun runtime. The update set `packageManager` to 1.4.2; this branch holds
   1.3.14 to match the ten CI setup pins and the guard test. Moving to 1.4.2 is
   its own branch: bump the ten `bun-version` pins, `packageManager`, and
   `security-hardening-scripts.test.ts:374-378` together.
2. Action majors. `deploy-production-release.yml` and `publish-docker.yml` run
   only on a release or a push to `main`. Watch their first run after merge.

Assumptions: the formatter's flow-sequence spacing (`[ main ]`) was unintended,
so the workflows keep the repo's `[main]` style. An editor that formats YAML on
save will reintroduce it and fail the same two guards.

Follow-up, own branch: `tests/data/service-worker-privacy.test.ts` "deletes
legacy capture entries" fails on Node 24.18 and 26.10 and passes on Node 22.
`engines.node` lists all three lines as supported.

---

# Session state, 2026-09-28: remove Sentry

Branch `claude/remove-sentry-nbj60e`, cut from `main` @ `aca6a90`. Non-trivial
tier by file count, run without a spec gate because the request ("remove
Sentry") is unambiguous and the owner was not in the loop.

- [x] Red: `security-hardening-scripts` asserts both SDKs are gone;
      `security-headers-policy` asserts `connect-src` has no Sentry origin.
- [x] Green: deleted `lib/sentry.ts`, `lib/sentry-safe-keys.ts`,
      `components/sentry-init.tsx`, `packages/mcp-server/src/utils/sentry.ts`
      and their tests; stripped forwarding from both loggers, `error-logger`,
      `global-error`, and the MCP entry point; removed the CSP origin from
      `app/layout.tsx`, the CloudFront policy, and `SECURITY.md`.
- [x] Docs: ADR 0017, trust-boundary row, architecture table, MCP README and
      Unreleased changelog entry, `.env.example`.
- [x] Version trio bumped to 13.6.0 (the export changes). MCP version left for
      the release flow.

## Resuming From Here

Next: open the PR. Follow-ups, each on its own branch: regenerate
`docs/diagrams/architecture.html` without the Sentry node (needs the
diagram-design geometry checker), and refresh `scripts/bundle-budget.json`
after a build now that the browser SDK is out of first-load JS.

---

# Session state, 2026-09-27: Vitest 5 migration

Branch `chore/vitest-5-migration`, cut from `main` @ `243950e`. Non-trivial tier;
the owner approved design decisions D1 to D5 in `tasks/spec-vitest-5-migration.md`.

- [x] Discovery: Vitest 5 fails 57 tests (jsdom's getter-only `navigator`) and drops
      `lib/sync/sync-provider.tsx` from coverage (exact glob matching). CI's runner
      ships Node 22.23.2, above Vitest 5's 22.12 floor.
- [x] Red confirmed, then 16 `navigator` writes moved to `vi.stubGlobal` with
      `vi.unstubAllGlobals()` in `afterEach`. Added `lib/**/*.tsx` to coverage.
- [x] Verified: 3,193 passed under Node 22 (same as Vitest 4), identical 269-file
      coverage set, typecheck, lint, shape, build, license, audit, and the MCP suite
      on its own Vitest 4.1.11.
- [x] Review follow-up (Codex, PR thread): `engines.node` set to jsdom's
      `^22.22.2 || ^24.15.0 || >=26.0.0`, README lists Node, and the three Vitest CI
      jobs pin Node 22. CI then caught MCP `test:coverage` borrowing the root's v5
      coverage provider; MCP now declares its own `@vitest/coverage-v8@4.1.11`.
- [x] PR #564 merged as `aca6a90`. Local branch deleted after an empty diff against
      `main`. No version bump: nothing here reaches `out/`.

## Resuming From Here

Up next, saved by the owner for the next session. One branch each, in any order.

1. **Move `packages/mcp-server` to Vitest 5.** Bump `vitest`, `@vitest/ui`, and
   `@vitest/coverage-v8` together (all 4.1.11 in `packages/mcp-server/package.json`).
   Update the pins in `tests/data/security-hardening-scripts.test.ts:358-359` in
   the same commit; `build-config.test.ts` already requires runner and provider to
   match. Before bumping, capture MCP's `coverage-summary.json` keys, then diff them
   after, because Vitest 5 matches coverage globs exactly. Also check the
   `clearMocks: true` default, hoisted `vi.mock` enforcement, and `test:ui`, which
   now needs the token URL Vitest prints. Verify with
   `bun run --cwd packages/mcp-server test:coverage`, the command CI and SonarCloud run.
2. **Clear the `__dirname` warning in `vitest.config.ts`.** Vite flags
   `path.resolve(__dirname, ".")` at `vitest.config.ts:66` as unsupported by
   `configLoader: 'native'`; use `import.meta.dirname`. Done means the warning is
   gone from `bun run test` output and the `@/` alias still resolves (the full suite
   passes). Leave `next.config.ts:17` alone: `build-config.test.ts` pins
   `turbopack: { root: __dirname }`, and that file is Next's, not Vite's.
3. **Retry jsdom 30.1.1 or newer.** Held at 30.0.1 because 30.1.1 leaves
   `color: var(--error-ink)` unresolved in computed styles, failing
   `tests/ui/global-error.test.tsx:71`. The component is correct in browsers. Check
   the newest jsdom first; if it still fails, choose between keeping the hold and
   changing how the test reads the color. A jsdom bump can change its
   `engines.node`, and `build-config.test.ts` requires the root `engines.node` to
   match it, so update `package.json` engines and the README floor
   (`documentation-currentness.test.ts`) in the same commit.

---

# Session state, 2026-09-26: `bun update --latest` repair

Branch `chore/deps-update-2026-09-26`, cut from `main` @ `7a7ddcf`. Standard
tier: `package.json`, `bun.lock`, the version trio, and three test files.

- [x] Root causes, each bisected in a clean worktree: `zod` 4.6.5 against
      stagehand's exact 4.4.3 pin (the build's type errors), `typescript` 7
      (typescript-eslint crashes), `vitest` 5 (`navigator` is getter-only, 57
      tests), and `jsdom` 30.1.1 (`var()` unresolved in computed `color`).
- [x] Held those four back and kept every other update.
- [x] Fixed the EditDrawer autofocus race in four tests. The new package mix
      exposed it.
- [x] Clean frozen install: typecheck, lint, shape, build, bundle budget, license,
      MCP tests, and the full suite with coverage under Node 22 all pass.

## Resuming From Here

Next: the owner runs a clean reinstall (`rm -rf node_modules && bun install`).
The local tree mixes 28 stale bun isolated-store symlinks into a hoisted layout,
so it loads two copies of React and Dexie. Then push and open the PR on approval.

Later, each on its own branch: migrate to vitest 5 (`vi.stubGlobal` for
`navigator`), revisit jsdom 30.1.1, and drop the zod pin once stagehand widens
its range. The `service-worker-privacy` failure is local to Node 26 and predates
this work.

---

# Session state, 2026-09-20: SyncProvider idle polling

Branch `fix/sync-provider-idle-polling` @ `fffaa29`, PR #558. Standard tier: one
source file, one new test file, no change to the `SyncState` shape.

- [x] Root cause confirmed in code: the 500 ms status poll had no enabled check
      (three IndexedDB reads per tick), and the reducer spread a new state object
      for every polled action, so each tick re-rendered every `useSync()` consumer.
- [x] Red tests, then the fix: poll only while `isEnabled || isSyncing ||
      pendingRequests > 0`, and `mergeIfChanged` in the reducer.
- [x] `pb-sync-reviewer` caught a lockout in my first version (sign-out during a
      running sync left `isSyncing` stuck on). Reproduced red, then fixed.
- [x] Measured on the production export: 65 `syncMetadata` reads per 10 idle
      seconds before, 5 after. Full suite, lint, typecheck, shape, bundle budget,
      and 21 sync e2e specs are green.

## Resuming From Here

Next: the owner merges #558, then sync `main` and delete the branch after the
verified check. Check every workflow on `main` after the merge.

Still open, out of scope here: the 2-second enabled check still polls, and an
enabled but idle provider still does three reads per tick. Both want an event from
the coordinator or a cross-tab signal. `lib/use-shell-command-handlers.ts:150`
still hardcodes `isSyncEnabled: false`.

No version bump: the owner's 13.5.0 bump is uncommitted in `package.json`.

---

# Session state, 2026-09-19: audit remediation (TST-1, SEC-1, E2E-1, PRF-1)

Four findings from the audit report below, one branch each. All four are
implemented, verified, and committed.

- [x] `TST-1`, PR #552, `fix/mcp-setup-require-crash`. Top-level `node:readline`
      import, a compiled-output smoke test, MCP 1.2.7 with a changelog entry.
- [x] `SEC-1`, PR #553, `docs/security-hosted-encryption-posture`. `SECURITY.md`
      separates the hosted service from the Docker image, ADR 0016 records the
      deferral, and a guard test pins the wording.
- [x] `E2E-1`, PR #554, `test/e2e-static-export` @ `cb9fc85`. Shared static export
      server, `playwright.export.config.ts`, 28 journeys, a CI step per browser
      leg. 84 of 84 pass on the built export. Spec appended to `tasks/spec.md`.
- [x] `PRF-1`, PR #555, `perf/bundle-budget-and-splits` @ `c5fe320`. CI byte
      budget, react-query scoped to two routes, confetti loaded on first use. `/`
      drops 11.6 KB of first-load gzip. Spec in `tasks/spec-bundle-budget.md`.

All four PRs were fully green in CI on 2026-09-19. Both new gates ran on the
Linux runners: the export journeys passed on Chromium, Firefox, and WebKit, and
the bundle budget held against the macOS baseline.

## Resuming From Here

Next, in order:

1. Done 2026-09-19: the owner merged #552, #553, #554, and #555. `main` is at
   `5a5885c`, and the four local branches are deleted after a verified check.
2. Done 2026-09-20: the owner merged PR #556. #554 had broken
   `Publish Docker Image` on `main` (`next build` in the image type-checks root
   TypeScript files, `.dockerignore` drops `tests/`, and
   `playwright.export.config.ts` imports from there). `main` @ `52c7bc3` is fully
   green, and the Docker publish passed there, which confirms the fix.
3. Done 2026-09-20: annotated tag `mcp-v1.2.7` on the #552 merge commit
   `46a6f5c`. The owner approved publish run 35510138936 (the `mcp-release`
   environment requires that approval in the GitHub UI), and it succeeded. npm
   serves 1.2.7 with SLSA provenance. Verified from real installs: 1.2.6
   `--setup` prints "Setup failed." with no prompt, and 1.2.7 shows the prompt
   and reaches the URL safety gate. Trap found on the way: `node -e` leaks a
   global `require`, so it hides this bug. Use `--input-type=module` or a `.mjs`
   entry, and run the known-bad version as a control.
4. Done 2026-09-20: the owner merged PR #557. `main` @ `7be37e3` is fully green
   (CI, Security Audit, SonarCloud, Publish Docker Image). The four install pins
   read 1.2.7. PR #552's "How to test" text now uses `node --input-type=module -e`.
   All six local branches from this work are deleted after a verified check.

This remediation is complete. What remains belongs to the owner:

- Done 2026-09-20: the owner deleted `tasks/implementation-notes.md`. Its content
  lives in `tasks/lessons.md`.
- The pinned `public/index.md` and the MCP server card reach `gsd.vinny.dev` with
  the next production deploy. npm and the GitHub README already show 1.2.7.
- The uncommitted 13.5.0 bump in `package.json` still needs `README.md:7` and
  `public/sw.js:3` to match before `documentation-currentness.test.ts` passes
  locally.

CI miss worth remembering: #554's first run failed `test`. A guard in
`tests/data/e2e-quality-gates.test.ts` pins the literal text of the e2e fixture's
font allowlist, and widening the allowlist broke the pin. Targeted tests passed
locally, and the full suite would have caught it. Fixed in `cb9fc85`.

Root suite on the PRF-1 branch: 3,175 passed, 2 failed. Both failures predate
this work: the uncommitted 13.5.0 bump against `README.md:7`, and the local-only
`service-worker-privacy` test.

Merge notes: the E2E-1 and PRF-1 branches both edit `ci.yml`, `package.json`, and
`CLAUDE.md`, in different places. `tasks/lessons.md` gets an end-of-file section
from E2E-1 and a mid-file addition from PRF-1, so neither should conflict.

Assumptions: the ADR 0016 rationale is reconstructed from project notes, so the
owner should read it before merging #553. `bun.lock` still records the MCP
workspace at 1.2.6, the same as after the 1.2.6 release commit.

Follow-ups found and left out of scope:

- `SyncProvider` polls the sync coordinator every 500 ms with an IndexedDB read,
  signed in or not (`lib/sync/sync-provider.tsx:254-261`).
- `lib/use-shell-command-handlers.ts:150` hardcodes `isSyncEnabled: false`, so the
  palette's sync commands never appear.
- The sync stack split: about 40 KB, four static import paths, one through the
  task write path. Its own PR with `pb-sync-reviewer` if wanted.
- Infra, outside this repo: the one EC2 instance these AWS credentials can see
  (`NewWebServer`, us-east-1) has an unencrypted EBS volume, and EBS encryption by
  default is off. Unconfirmed whether it serves `api.vinny.io` (52.22.29.139).

---

# Session state, 2026-09-19: codebase audit report

Branch: `main`, at `6a71a65`. Report only, no code changes. Left uncommitted at
the owner's request.

- [x] Phase 1: measured evidence, five read-only subagents, findings list approved.
- [x] Phase 2: rendered `docs/codebase-analysis-report.html` and the shipped copy
      at `public/docs/codebase-analysis-report.html`. The two files are identical.
- [x] Verified: tests that read the report pass, the build externalizes its inline
      assets, and it loads under the production CSP with no violations.

## Resuming From Here

The report scores the codebase 7 of 10 with 43 findings: 2 High, 22 Medium, and
19 Low. Both High findings are small fixes.

- `TST-1`: `gsd-mcp-server --setup` crashes. `packages/mcp-server/src/cli/index.ts:99`
  calls a bare `require` inside an ESM package. The bug is in tag `mcp-v1.2.6`.
- `SEC-1`: `SECURITY.md:79-82` says task content is encrypted at rest. Production
  runs the PocketBase CLI on EC2, so the Docker key guard never runs there.

Next: the report's 30-day list. Start with the two High findings, then `STD-1`
(both #549 and #550 merged with `lint` red through the `--admin` bypass).

Blockers: none. Four files are uncommitted on `main`: the two report copies, plus
the owner's own `package.json` bump to 13.5.0 and `bun.lock`. That bump fails
`documentation-currentness.test.ts` until `README.md:7` and `public/sw.js:3` match.

Assumption: `SEC-1` rates High on the owner's statement that production is not
Docker. It drops to Low if the EC2 host loads the encryption hooks with the key.

Nothing regenerates the shipped report on release (finding `DOC-3`).

---

# Session state, 2026-09-19: copy Cloud Sync auth token

Branch: `feat/copy-cloud-sync-token`. Standard tier; approved design and full
verification evidence in `tasks/spec-cloud-sync-auth-token.md`.

- [x] Spec and implementation plan recorded from the approved design.
- [x] Red: focused clipboard/auth lifecycle tests fail before implementation.
- [x] Green: add Settings row and update MCP setup/recovery guidance.
- [x] Verify unit/MCP tests, coverage, typecheck, lint, running browser and independent review.
- [x] Commit the verified implementation on the feature branch.

## Resuming From Here

Implementation complete locally. Copy auth token is under Settings → Cloud Sync,
with fresh-token checks, clipboard feedback and updated MCP instructions.
Chromium and WebKit checks pass with synthetic auth. Firefox could not launch
because its temporary profile was missing. Independent review found no issues.

Full suite: 3,162 passed, 1 skipped, 2 pre-existing failures (README release text,
service-worker capture cache). Existing pwa-register code-shape debt also fails.
All reproduced at unchanged HEAD; the token-copy tests, lint and typecheck pass.
MCP: 319 passed, 4 skipped, build and coverage pass. New UI component: 95.45%
statement coverage.

Follow-up: user authorized bump/commit/push/PR. App, README and tracked SW version
are 13.1.5; 28 focused release checks, lint, typecheck and production static build
pass. The README failure above is now resolved. Baseline service-worker privacy
and pwa-register shape failures remain. Publishing this branch does not deploy it.

---

# Session state, 2026-09-15 (proxy-addr advisory, AIKIDO-2026-101201)

Branch: `fix/proxy-addr-floor`, cut from `main` @ `49b543c`. Standard tier: three
files, no interface change.

Aikido flagged `proxy-addr` 2.0.7 (GHSA-jqcg-44mw-7w3h, CVE-2026-90711), reached
through the `@modelcontextprotocol/sdk` dependency on `express`. The MCP server
runs over stdio and never configures `trust proxy`, so nothing here is reachable.
The fix is lockfile hygiene so Aikido and the Security Audit workflow stay green.

The `public/sw.js` edit in the tree (13.1.1) is the build artifact of deploying
13.1.0 and stays unstaged. The pre-existing `bun update` churn in `bun.lock` was
set aside (copy in the session scratchpad) so this lock diff is proxy-addr only.
`bun update` regenerates that churn on demand.

## Plan

- [x] 1. Red: assert `overrides['proxy-addr'] === '>=2.0.8'` in
      `tests/data/security-hardening-scripts.test.ts`.
- [x] 2. Green: add the floor to root `package.json`, then `bun install`. The lock
      moves proxy-addr from 2.0.7 to 2.0.8 and nothing else.
- [x] 3. Gates: guard test, `bun install --frozen-lockfile`, `bun audit`,
      `bun run test`, `bun typecheck`, `bun lint`, `bun run build`.
- [ ] 4. Commit, push, PR, merge, fast-forward main, delete branch.

## Resuming From Here

- Done: steps 1 to 3. All gates green except the known local-only
  `service-worker-privacy` failure ("deletes legacy capture entries"), which fails
  identically against main's committed `sw.js` while CI on main @ `49b543c` is green.
- Next: push `fix/proxy-addr-floor`, open the PR, watch `gh pr checks`, merge with
  `gh pr merge --squash --admin`, fast-forward main, delete the branch.
- Note: `bun audit` and GitHub's advisory GraphQL had not ingested the CVE on
  2026-09-15; Aikido was first. The upstream HISTORY.md and the repo's
  `security-advisories` endpoint confirmed 2.0.8 as the patched release.
- Assumption: no version trio bump, matching PR #536 (a dependency-only fix that
  changes neither the shipped web bundle nor the MCP package).

# OSS Scanner enrollment (2026-10-09)

Tier: Standard (three new files under `.oss-scanner/`, no app or contract change).
Branch `chore/oss-scanner-enrollment` from `main` @ `37e33e5`, worked in the worktree
at `.claude/worktrees/oss-scanner`. These notes sit at the end of the file so they
can't collide with the modernization session state above.

- [x] `.oss-scanner/Dockerfile`: node:22-bookworm, sqlite3, both pinned PocketBase
      binaries under `/tmp`, Bun from `packageManager`, the frozen lockfile,
      Playwright's browsers, the static export, and the MCP server build. Vitest
      and the system tests run as non-fatal checks.
- [x] `.oss-scanner/Dockerfile.dockerignore`. The root `.dockerignore` drops
      `tests/` and `.git/` for the self-host image, so the scanner build uses its
      own ignore file.
- [x] `.oss-scanner/threat_model.md`.
- [x] Build-check with upstream's `check_build` steps against a clean clone. The
      first run failed twice: no `sqlite3`, and the upgrade test outside dev mode
      (see lessons.md). After both fixes the image builds in 5.8 minutes, Vitest
      passes 3412 tests, and the system tests pass 6 of 6.
- [x] Offline in the finished image with 2 CPUs and 8 GB: typecheck, lint, and
      knip pass; the MCP suite passes 354 of 354; Chromium e2e passes 117; the
      export journeys pass 28; the CSP smoke passes. Firefox and WebKit e2e were
      not run here; CI covers them.
- [x] `projects/gsd-taskmanager/project.yaml` passes upstream's `tools/validate.py`.

## Resuming From Here

- Done: committed on `chore/oss-scanner-enrollment`. Nothing is pushed.
- Next, in order, and all Vinny's call:
  1. Push the branch, open a PR here, and merge it. The scanner reads the
     Dockerfile from the default branch, so this lands first.
  2. Fork anthropics/oss-scanner, add `projects/gsd-taskmanager/project.yaml`
     with the contents below, run `tools/validate.py` and
     `tools/check gsd-taskmanager`, then open the PR. Vinny ticks the
     core-maintainer, terms, and contact boxes and signs the CLA.
- project.yaml:

      repo: https://github.com/vscarpenter/gsd-task-manager
      primary_contact: vscarpenter@gmail.com
      homepage: https://gsd.vinny.dev
      disabled: false
      dockerfile: .oss-scanner/Dockerfile
      threat_model: .oss-scanner/threat_model.md

- Assumptions: primary_contact uses the address already public in the commit
  history. `security.txt` lists only GitHub private advisories, and the scanner
  needs an email. The severity ratings in the threat model are defaults to tune.
  No version trio bump, since nothing in the web bundle or the MCP package changed.
- Finding, not fixed: the upgrade system test depends on PocketBase's dev mode
  (lessons.md). Passing `--dev` in the test would make it location-independent.

# Synced-field backfill (2026-10-27)

Tier: Standard on the web (bounded sync change, no new public surface), paired with
the iOS branch of the same name. Branch `fix/synced-field-backfill` from `d17cfb3`.
Decision: `docs/adr/0019-pull-contract-version-backfill.md`.

- [x] Failing tests: same-version merge during a backfill pull (`pb-pull.test.ts`),
      contract upgrade forces one full pull then stamps the version
      (`full-sync-real-writers.test.ts`).
- [x] `SYNC_CONFIG.PULL_CURSOR_VERSION` = 3; `resolvePullCursor` returns a plan;
      `pullRemoteChanges` takes `mergeSameVersion`; config writers use the constant.
- [x] Full vitest suite, typecheck, lint, code shape, knip.
- [ ] Build, bundle budget, commit. Push and PR wait for the owner.

## Resuming From Here

- Done: the fix, its tests, ADR 0019, the sync rule note, version 14.2.1.
- Next: owner's push and PR for both repos.
- Blockers: none locally. The preflight found a leftover `autostash` on main from
  2026-10-26 (package.json and bun.lock); it was left alone.
- Assumptions: bumping the contract now, so every web client does one full pull
  after this release, is preferable to shipping a dormant mechanism.
