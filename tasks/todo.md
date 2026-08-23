# Status — 2026-08-22

## Matrix usability tweaks (design handoff) — DONE (uncommitted → see below)

Branch `feat/matrix-usability-tweaks`. Source: `design_handoff_matrix_usability_tweaks/README.md`
(+ `Matrix Review.dc.html` frames 1a baseline / 1b target). Tier: Standard.

- [x] ① `matrix-intro.tsx` — one flex row; h1 `text-display` → `text-h2`; Protect Q2
      card → one accent button `Protect Q2 · {n} to schedule` (`· clear` at 0).
      Props unchanged. Row starts at `sm:` — see the mobile trap below.
- [x] ② `matrix-grid.tsx` — `AxisFrame` wraps the grid with URGENT / NOT URGENT
      column labels and vertical IMPORTANT / NOT IMPORTANT row labels, all
      `aria-hidden`, all hidden below `@min-[696px]`.
- [x] ③ `quadrant-pane.tsx` — count pill takes `bg-card` + inline `--q*-ink`,
      weight 600. Measured AA: q3 ochre 6.59:1 light, 8.07:1 dark.
- [x] ④ task-card — corner badge and `reserveBadgeSpace`/`pr-24` removed; rust
      chip leads the footer row, `{n}d overdue · {short date}`. `overdueDays`
      is now a required `TaskCardActions` prop.

Verified live (dev, SW busted, IndexedDB seeded, 1440x900 + 390 + dark):
all four quadrant headers at y=347/658, well above the 900 fold; console clean
apart from the pre-existing `[PWA] Periodic sync registration failed` warning.

### Traps found

- **The handoff frame is a 1500px desktop board.** Taking its single row
  literally overflowed a 390px phone by 64px — the old layout was a grid that
  stacked below `lg`, and an unconditional flex row dropped that. Fixed with
  `flex-col … sm:flex-row`; pinned by `tests/e2e/matrix-briefing-fold.spec.ts`,
  which fails against the unconditional row.
- **The handoff says `rounded-lg` "(10px radius)".** In this repo `rounded-lg`
  is 14px; 10px is `--r-sm` → `rounded-sm`. Frame 1a confirms the step-down is
  intentional. Trust the pixel value and token name, not the class name.
- **`quality:shape` is already red on a clean `main`** (pb-pull, pb-sync-engine,
  sentry, terminal-block, capture-bar). This change adds nothing to it — the
  axis frame and the count-pill class list were extracted to keep both touched
  files at their baseline.

### Resuming From Here

Done: all four changes implemented, verified live, and green on
`bun run test` (2799), `bun typecheck`, `bun lint`, `bun run test:e2e --project=chromium` (112).

Next: **not yet committed at the time of writing** — commit the source/test
files only. Deliberately NOT staged: `package.json` + `bun.lock` (unrelated
`@browserbasehq/stagehand` bump already in the tree), `design_handoff_*/`,
`first-run-guide.html`.

Blockers: none. Open decision for the user: the compact briefing drops the
`aria-live="polite"` region that used to announce the Q2 count, because the
handoff collapses that whole card into the button label. The count is still in
the button's accessible name. Re-adding a live region to a button label would
announce on every Q2 change, which is noisier than what it replaces.

Version bumped to **12.0.1** (patch) across the release trio: `package.json`,
`README.md:7`, and `public/sw.js` CACHE_VERSION. Hand-edited rather than run
through `scripts/update-sw-version.cjs` — `.build-info.json` is stale at 12.0.0
and the script prefers it, so it would have written the old version back.

# Status — 2026-08-16

## UI Polish Pass (/ui-craft polish) — DONE

Shipped as PR #504 (squash-merged to main as 942cab9); local + remote branch
deleted. Verified live before push (SW busted, DOM assertions, clean console).

## gsd-mcp-server 1.2.4 publish — DONE

npm serves 1.2.4 (latest); GitHub Packages published.

- Leaked npm token: REVOKED by user 2026-08-16. No replacement token needed —
  the workflow now uses OIDC Trusted Publishing (see below). The dead
  `NPM_TOKEN` GitHub secret can be deleted (`gh secret delete NPM_TOKEN`).

## OIDC Trusted Publishing — DONE (validated as far as possible pre-release)

PR #505 merged (58ed107). npmjs.com trusted publisher configured by user
2026-08-16 and reviewed field-by-field: vscarpenter/gsd-task-manager /
publish-mcp-server.yml / environment mcp-release / npm publish permission.
Dry-run dispatch (run 31969840150) green end-to-end on the new workflow:
Node 24, npm 11.17.0, build + pack clean, publish steps correctly skipped.

Cleanup completed 2026-08-16 (all user-approved):
- `NPM_TOKEN` secret deleted from GitHub (verified absent)
- Remote OIDC branch was already auto-removed at merge; refs pruned
- npmjs Publishing access set to strict ("require 2FA, disallow bypass-2fa
  tokens") — saved with security-key confirmation, "package scope updated!"

Remaining: the OIDC exchange itself is only provable on the next real
`mcp-v*` release — if it fails auth, suspect a publisher-config field
mismatch before the workflow.

## Working-tree leftovers (deliberate, uncommitted on main)

bun.lock + package.json (stagehand ^4.0.1 bump) and public/sw.js
(CACHE_VERSION 12.0.1) — pre-staged version-bump material from a prior
session; commit them with the next release, not with feature work.

## In flight: editorial imports from first-run-guide (feat/editorial-imports)

Pulling four approved design elements from first-run-guide.html into GSD
(analysis + side-by-side artifact in session 824c95b2, 2026-08-17):

1. `.kicker` mono eyebrow class in globals.css; unify the seven drifting
   about-page eyebrow call sites; amend the mono-scope line in
   .ui-craft/tokens.md + DESIGN.md.
2. TerminalBlock component (TDD) with copy button; replaces the bare
   pre/code in components/about/mcp-section.tsx.
3. Dark-mode shadows become 1px white ring + faint blur in
   inkwell-tokens.css (both dark branches identical).
4. About hero h1 goes clamp()-fluid; app surfaces keep the fixed scale.

No version bump here — per the note above, version material rides with
the next release. Left untouched: bun.lock/package.json/sw.js leftovers.

### Resuming From Here (2026-08-17, feat/editorial-imports)

Done: all four editorial imports implemented, verified, and committed
locally (5 commits, 521c0a1..6702a15). Full suite 2784 green, typecheck +
lint clean. Live-verified headlessly (Playwright vs bun dev): 80px fluid
hero, mono kickers, copy → Copied → revert with real clipboard content,
#11100B dark terminal, ring shadow live on dark matrix panes. Verification
caught + fixed: code-chip tint bleeding into the terminal (6702a15).

Next: push + open PR (awaiting go-ahead). Not committed on purpose:
bun.lock / package.json / sw.js release leftovers, this file,
first-run-guide.html, next-env.d.ts (dev-server regen),
.tmp-preview-guide-vs-editorial.html (rm was denied — delete manually).
