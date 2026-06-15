# GSD Task Manager — Task Tracker

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
- [ ] Verify whether PocketBase rate-limits all requests or only writes. If all requests, the bulk preflight doubles request count but the throttle only sleeps between iterations — may still trip 429s on large bulks. Either apply throttle to both preflight and write, or document the assumption.
- [ ] Pre-existing `findPBRecordId` in `helpers.ts` has the same silent-error-swallowing flaw fixed in PR5 for `fetchSinglePBTaskFresh`. Apply the same `status === 404` discrimination there.
- [ ] Add lessons.md entry: MCP write-path test fixtures didn't catch the original stale-spread bug because mocks never went stale between calls. Future tests should exercise the read→write timeline, not just data shapes.

