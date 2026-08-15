# Editorial Restore — Ship Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Review, verify, clean up, and ship the uncommitted GSD Editorial reskin on branch `design/editorial-restore` as a 4-commit PR to main.

**Architecture:** The reskin already exists in the working tree (tokens 1.4.0, Newsreader, restored assets). This plan adds no features: it reviews the diff, renames the theme test, sweeps stale Violet Frost references, realigns the durable design docs, runs the gates, does visual QA, then splits the tree into four conventional commits and opens a PR.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, Vitest, Playwright, bun.

**Spec:** `tasks/editorial-restore-handoff.md` (the handoff is the spec; DESIGN.md is the design authority).

## Global Constraints

- Do NOT adjust any value back toward Violet Frost. DESIGN.md is the authority.
- Keep `package.json`, `bun.lock`, and any `.agents/` edits out of every commit (pre-existing dirt: stagehand `^4.0.0 → ^4.0.1`). Do NOT bump the version — Vinny decides 12.0.0 vs patch in the PR (current: 11.11.12).
- `GSD-Design-Reference.html` must stay byte-identical to `~/Projects/gsd-iosapp/Design/GSD-Design-Reference.html`. It is identical right now — if you edit it, mirror the edit there.
- The theme contract test must pass **as written**; fix failures on-palette, never by loosening the test.
- Approved exemptions to the acceptance hex grep (`5C4F7D|B95F5A|4D7A72|A99BCB|D88C86`), to be noted in the PR body: `app/design-lab/**`, `components/design-lab/design-data.ts` (historical lab catalog, imported only by design-lab pages), and the theme test's `RETIRED_COLORS` list (the enforcement mechanism).
- Intentional Violet Frost mention that stays: `app/css/inkwell-tokens.css:7` (version-history prose in the new 1.4.0 header explaining why the version bumped).
- Commit messages and PR body follow vinny-voice: active voice, no em dashes, no filler. Conventional commits with scope. Claude-Session trailer per the creating-git-commits skill.
- Never commit on main; stay on `design/editorial-restore`. Push + PR carry standing approval from the handoff.

---

### Task 1: Preflight cleanup and diff review

**Files:**
- Delete: `tests/e2e/zz-probe.spec.ts` (self-declared "TEMPORARY diagnostic — deleted before commit")
- Review only: all 25 modified files

- [ ] **Step 1: Delete the probe spec** (it would otherwise run in the e2e gate)

```bash
rm tests/e2e/zz-probe.spec.ts
```

- [ ] **Step 2: Review the diff group by group.** Look for values off the Editorial palette, leftover debug code, and anything unrelated to the reskin.

```bash
git diff app/css/inkwell-tokens.css          # tokens: header says 1.4.0, tide #2C6680, ink-3 #797368/#948A79
git diff app/globals.css app/css/inkwell-components.css   # quadrant washes/headers, select chevron stroke
git diff app/layout.tsx                       # Albert Sans out, Newsreader in via next/font, --font-newsreader
git diff app/global-error.tsx tests/ui/global-error.test.tsx  # hardcoded fallback palette + its test
git diff tests/data/violet-frost-theme.test.ts tests/ui/app-pages.test.tsx  # Editorial contract, font mock
git diff DESIGN.md GSD-Design-Reference.html  # rewritten authority + ink3 values
git diff public/manifest.json public/favicon.svg public/icons/icon.svg public/og-image.svg
git diff --stat public/                       # binary assets restored from c3558da5~1
git diff public/docs/codebase-analysis-report.html | grep -iE "^[+-].*#[0-9A-Fa-f]{6}" | head -30  # hex remap only
```

- [ ] **Step 3: Confirm the iOS mirror is still byte-identical**

```bash
diff -q GSD-Design-Reference.html ~/Projects/gsd-iosapp/Design/GSD-Design-Reference.html
```

Expected: no output (identical). Record any review findings before moving on; fix on-palette if something is off.

### Task 2: Rename the theme contract test

**Files:**
- Rename: `tests/data/violet-frost-theme.test.ts` → `tests/data/editorial-theme.test.ts`

Nothing references the old filename (verified repo-wide); vitest finds it by glob.

- [ ] **Step 1: Rename**

```bash
git mv tests/data/violet-frost-theme.test.ts tests/data/editorial-theme.test.ts
```

- [ ] **Step 2: Run the renamed test**

```bash
bun run test -- tests/data/editorial-theme.test.ts
```

Expected: PASS. (Note: `git mv` stages the rename; Task 8 resets the index before selective staging, which un-stages it safely.)

### Task 3: Sweep stale Violet Frost / Albert Sans references

**Files:**
- Modify: `tests/ui/task-card-anatomy.test.tsx:96` (comment) and `:177` (describe name)
- Modify: `tests/e2e/touch-targets.spec.ts:86`
- Modify: `components/dashboard/stats-card.tsx:66`
- Modify: `components/task-card/index.tsx:57`
- Modify: `app/css/inkwell-components.css:771`

Leave `app/design-lab/**` and `components/design-lab/design-data.ts` alone (standalone experiments and their data). Leave `app/css/inkwell-tokens.css:7` alone (intentional history). Line numbers are pre-edit anchors; match on text.

- [ ] **Step 1: task-card-anatomy.test.tsx** — comment near line 96:

Old: `// Violet Frost gives the quadrant mark enough weight to hold its own beside`
New: `// The quadrant mark gets enough weight to hold its own beside`

Describe near line 177:
Old: `describe("QuadrantPane header — Violet Frost quadrant identity", () => {`
New: `describe("QuadrantPane header — quadrant identity", () => {`
Also update the section banner comment above it: `// Quadrant header identity (Violet Frost)` → `// Quadrant header identity`

- [ ] **Step 2: touch-targets.spec.ts** — near line 86:

Old: `// min-width/min-height is that Violet Frost's compact control shapes`
New: `// min-width/min-height is that Editorial's compact control shapes`

- [ ] **Step 3: stats-card.tsx** — comment near line 66. The font claim is stale twice over (Albert Sans is gone, the serif is back). Keep the "why 40, not 48" rationale without the font history:

Old:
```
{/* 40px, not 48: Albert Sans carries more optical weight than the
    retired serif did, so the old size read as shouting. */}
```
New:
```
{/* 40px, not 48: at this weight the metric already dominates the card,
    so the larger size read as shouting. */}
```

- [ ] **Step 4: task-card/index.tsx** — comment near line 57:

Old: `// Violet Frost floats the panes, so cards need a whisper of elevation to sit`
New: `// The panes float on the canvas, so cards need a whisper of elevation to sit`

- [ ] **Step 5: inkwell-components.css** — comment near line 771:

Old: `keeps Violet Frost's compact 18px shape and still answers a 44px tap —`
New: `keeps the compact 18px shape and still answers a 44px tap —`

- [ ] **Step 6: Verify the sweep**

```bash
grep -rni "violet\|frost\|albert" app components lib tests
```

Expected survivors ONLY: `app/design-lab/**`, `components/design-lab/design-data.ts`, `app/css/inkwell-tokens.css:7` (history prose), and `tests/data/editorial-theme.test.ts` (its retired-palette comment, `RETIRED_COLORS` list, and the Tailwind `violet` hue in the `RAW_SEMANTIC_HUE` regex). Anything else: clean it.

### Task 4: Bump the vendored inkwell-theme.css header

**Files:**
- Modify: `app/css/inkwell-theme.css:3`

The handoff asks for a decision: sync or mark stale. Decision: neither is needed at value level — line 29 is `@import url('inkwell-tokens.css')`, so the file already resolves to 1.4.0 Editorial values at runtime. Only the header version lies.

- [ ] **Step 1: Edit the header**

Old: `   Version: 1.3.1`
New: `   Version: 1.4.0 (values flow from inkwell-tokens.css via @import)`

- [ ] **Step 2: Confirm nothing else in the file is palette-bound**

```bash
grep -nE "#[0-9A-Fa-f]{6}|Albert|Violet|Frost" app/css/inkwell-theme.css
```

Expected: no hits (aliases only, `var(--...)` everywhere).

### Task 5: Realign the durable design docs (approved scope addition)

**Files:**
- Modify: `CLAUDE.md:31` (Design Context bullet)
- Modify: `PRODUCT.md:23,33,54`
- Modify: `.ui-craft/brief.md:14,99`
- Modify: `.ui-craft/tokens.md` (multiple sections; lines 3, 9, 127, 133–137 at minimum)

Source of truth for every value: `app/css/inkwell-tokens.css` (1.4.0) and `app/layout.tsx`. Canonical facts: system name **Inkwell 1.4.0 "GSD Editorial"**; canvas `#F4F1E9`, paper `#FFFFFF`, slate (graphite ink) `#211E1A`; accent = tide `#2C6680` (6.33:1 on paper), dark accent = lifted tide `#6FAACB`; light `--gray-500` `#6E6760` (5.6:1 on paper, 4.9:1 on ivory, per the token file's own comment); `--ink-3` `#797368` light / `#948A79` dark; display font Newsreader via `next/font` (`--font-newsreader` feeding the `--serif` chain), body system sans.

- [ ] **Step 1: CLAUDE.md line 31** — replace the Visual system bullet with:

```
- **Visual system:** Inkwell 1.4.0 "GSD Editorial" — warm paper surfaces, graphite ink, Newsreader serif display over system sans, and restrained tide (#2C6680) for global interaction, with four matrix-only quadrant families. Runtime primitives live in `app/css/inkwell-tokens.css`; quadrant washes/headers live in `app/globals.css`; the durable contract is `DESIGN.md` plus `.ui-craft/brief.md` and `.ui-craft/tokens.md`. Tide is interaction ink, never gradient decoration. WCAG AA is the baseline, and quadrant titles must use `--q*-ink` rather than raw pigment.
```

- [ ] **Step 2: PRODUCT.md** — three edits:

Line 23: `the restraint of Inkwell Violet Frost makes that personality visible through Albert Sans, a lavender-gray canvas, pale paper surfaces, quiet boundaries, and a single aubergine interaction color.`
→ `the restraint of Inkwell GSD Editorial makes that personality visible through Newsreader serif display over system sans, a warm paper canvas, quiet boundaries, and a single tide interaction color.`

Line 33: `Violet Frost uses aubergine as restrained interaction ink, never as gradient decoration.`
→ `Editorial uses tide as restrained interaction ink, never as gradient decoration.`

Line 54: `Violet Frost's light `--gray-500` (`#646477`) measures 5.69:1 on paper (`#FDFDFF`), so muted text has a documented floor.`
→ `Editorial's light `--gray-500` (`#6E6760`) measures 5.6:1 on paper (`#FFFFFF`), so muted text has a documented floor.`

- [ ] **Step 3: .ui-craft/brief.md** — rewrite line 14's system sentence to name Inkwell 1.4.0 GSD Editorial (Newsreader display serif, warm paper canvas, tide interaction ink) and line 99's clause (`keeps Violet Frost calm` → `keeps Editorial calm`). Keep surrounding argument structure intact.

- [ ] **Step 4: .ui-craft/tokens.md** — update the header note (line 3: "documents the shipped Violet Frost contract" → GSD Editorial), the layer intro (line 9), the naming warning (line 127: no gradients from the palette name), and the typography section (lines 133–137): Albert Sans is out; Newsreader loads via `next/font` as `--font-newsreader` feeding `--serif` for display; `--sans` is the system stack for body. Cross-check every hex and token name you touch against `app/css/inkwell-tokens.css` before writing it.

- [ ] **Step 5: Verify**

```bash
grep -rni "violet\|frost\|albert\|aubergine\|lavender" CLAUDE.md PRODUCT.md .ui-craft/
```

Expected: no hits (`.ui-craft/decisions.md` and `patterns.md` are already clean).

### Task 6: Run the gates

- [ ] **Step 1: Kill any stale dev server first** (Playwright reuses a running `bun dev`, which serves stale chunks)

```bash
pkill -f "next dev" || true
```

- [ ] **Step 2: Run each gate; fix failures on-palette**

```bash
bun run typecheck
bun run lint
bun run test
bun run quality:shape
bun run test:e2e
```

Expected: all green, including `tests/data/editorial-theme.test.ts` as written. If a gate fails twice without a diagnosed root cause: halt and re-plan (superpowers:systematic-debugging). Record the pass/fail lines for the PR body.

### Task 7: Visual QA in the running app

Use the **`/verify-frontend-change`** skill (repo-mandated): it busts the service-worker cache and seeds IndexedDB, both of which otherwise produce false passes. Dark mode toggles via Settings → Appearance, not localStorage.

- [ ] **Step 1: Invoke `/verify-frontend-change`** with goals covering, in light AND dark:
  - Matrix: quadrant washes, header bands, card spines on-palette.
  - Dashboard Completion Trend: the dotted Created line must read clearly in dark mode (this is the `--ink-3: #948A79` fix; seeded tasks required).
  - Tide on buttons, links, and focus rings; Newsreader on display headings; the help drawer; the favicon in the tab.

- [ ] **Step 2: Assess the restored screenshots.** `public/gsd-matrix.png` (804×391, README hero) and `public/og-image.png` (1200×630, OG metadata in `app/layout.tsx`) came back from June and predate recurrence. Compare each against the live reskinned app. If the gap shows (missing recurrence chips, changed chrome), recapture: gsd-matrix.png as a seeded-matrix screenshot at 804×391 via the Playwright/stagehand harness; og-image.png by rendering `public/og-image.svg` at 1200×630 (headless Chrome screenshot of the SVG works; no repo script exists). Then re-run `bun run test -- tests/data/editorial-theme.test.ts` — it asserts rasters carry no retired colors.

### Task 8: Commit in four logical commits

The tree holds all four concerns at once, so stage selectively. The ink-3 unification shares `app/css/inkwell-tokens.css` with the reskin; split it by temporarily reverting the three ink-3 values to the original Editorial ones for commit 1, then restoring them for commit 2. Original values (from `c3558da5~1`): light `#A49B8D`, dark `#6F685B` (two dark slots). Unified values: light `#797368`, dark `#948A79` (two slots).

- [ ] **Step 1: Snapshot and reset the index**

```bash
shasum app/css/inkwell-tokens.css   # record; must match again after Step 4
git reset                            # un-stages the Task 2 rename; the tree keeps it
git status --porcelain               # confirm expected files only
```

- [ ] **Step 2: Commit 1 — the reskin.** Edit `app/css/inkwell-tokens.css`: set the light `--ink-3` to `#A49B8D` and both dark `--ink-3` slots to `#6F685B`. Then:

```bash
git add app/css/inkwell-tokens.css app/globals.css app/css/inkwell-components.css \
        app/css/inkwell-theme.css app/layout.tsx app/global-error.tsx \
        components/dashboard/stats-card.tsx components/task-card/index.tsx \
        public/manifest.json public/favicon.svg public/icons/ public/og-image.png \
        public/og-image.svg public/gsd-matrix.png public/docs/codebase-analysis-report.html
git commit   # feat(theme): restore the GSD Editorial palette
```

Message body: what came back (warm paper, graphite ink, tide, Newsreader), that structure from 1.3.x is kept, tokens bumped to 1.4.0, assets restored from the pre-Tidewater commit. Claude-Session trailer per creating-git-commits.

- [ ] **Step 3: Commit 2 — the tertiary-ink unification.** Restore in `app/css/inkwell-tokens.css`: light `--ink-3: #797368`, both dark slots `--ink-3: #948A79`. Verify, then:

```bash
shasum app/css/inkwell-tokens.css    # must equal the Step 1 snapshot
git add app/css/inkwell-tokens.css GSD-Design-Reference.html
git commit   # feat(theme): unify tertiary ink with ios
```

Body: `--ink-3` now `#797368` light / `#948A79` dark, matching iOS `Surface.ink3`; fixes the dotted chart line legibility in dark mode; design reference updated to match (byte-identical to the iOS repo copy).

- [ ] **Step 4: Commit 3 — the tests**

```bash
git add tests/data/violet-frost-theme.test.ts tests/data/editorial-theme.test.ts \
        tests/ui/app-pages.test.tsx tests/ui/global-error.test.tsx \
        tests/ui/task-card-anatomy.test.tsx tests/e2e/touch-targets.spec.ts
git commit   # test(theme): retarget the theme contract to editorial
```

(The first `git add` pair records the rename; git pairs the delete + add.)

- [ ] **Step 5: Commit 4 — the docs**

```bash
git add DESIGN.md CLAUDE.md PRODUCT.md .ui-craft/brief.md .ui-craft/tokens.md
git commit   # docs(design): rewrite the design contract for editorial
```

- [ ] **Step 6: Verify the split left nothing behind**

```bash
git status --porcelain
```

Expected leftovers ONLY: ` M package.json`, ` M bun.lock`, `?? tasks/editorial-restore-handoff.md`, `?? docs/superpowers/plans/2026-08-15-editorial-restore-ship.md`. Then `bun run test` once more on the committed tree.

### Task 9: Push and open the PR

- [ ] **Step 1: Push**

```bash
git push -u origin design/editorial-restore
```

- [ ] **Step 2: Open the PR to main** (gh pr create). Body per vinny-voice, containing:
  - What: Editorial restore (why, what's kept from Violet Frost structurally, the ink unification).
  - Gate results: the actual pass lines from Task 6, including e2e.
  - **Version question, flagged for Vinny:** Tidewater took 11.0.0; this restore may deserve 12.0.0 (current 11.11.12). Decision happens on the PR; `package.json` is deliberately untouched (pre-existing stagehand dirt kept out).
  - Acceptance-grep exemptions: `components/design-lab/design-data.ts` (lab catalog data) and the `RETIRED_COLORS` list in the renamed theme test.
  - Scope note: docs realignment (CLAUDE.md, PRODUCT.md, .ui-craft) added with approval; gsdtaskmanager.com and gsd-iosapp diffs ship separately.
  - Screenshots of light + dark matrix from Task 7.
  - Claude-Session link trailer.

- [ ] **Step 3: Update `tasks/todo.md`** with "Resuming From Here" (PR number, version question pending, iOS/website repos still carry their own uncommitted diffs), and delete this plan's scratch artifacts if any were made.

## Acceptance (from the handoff, refined)

- All gates green, including e2e.
- `grep -rniE "5C4F7D|B95F5A|4D7A72|A99BCB|D88C86" app components lib tests public` returns hits only in `app/design-lab/**`, `components/design-lab/design-data.ts`, and `tests/data/editorial-theme.test.ts` (approved exemptions).
- `GSD-Design-Reference.html` byte-identical to `~/Projects/gsd-iosapp/Design/GSD-Design-Reference.html`.
- `package.json`/`bun.lock` untouched by every commit; no version bump.
- PR open against main with gate results and the version question flagged.
