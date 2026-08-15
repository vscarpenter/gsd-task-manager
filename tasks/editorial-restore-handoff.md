# Finish and ship the Editorial restore

Branch `design/editorial-restore` holds uncommitted changes that re-skin the web app from Violet Frost back to GSD Editorial: warm paper surfaces, graphite ink, the tide accent (#2C6680), and Newsreader serif display over system sans. This realigns the web app with the iOS app, gsdtaskmanager.com, and the brand kit. The work keeps the structural improvements from the Violet Frost era (four-layer quadrant families, the fill and on-color token pairs, 1px rules, the fixed type ramp) and bumps the token version to 1.4.0. It also unifies tertiary ink with iOS: `--ink-3` is now #797368 light and #948A79 dark. DESIGN.md at the repo root was rewritten and is the authority. Do not adjust values back toward Violet Frost.

Every color pairing was checked against WCAG AA before it landed (117 checks on the restore, plus a contrast pass on the ink change). Your job is review, local verification, cleanup, and shipping.

## What changed

- Tokens and styles: `app/css/inkwell-tokens.css`, `app/globals.css`, `app/css/inkwell-components.css` (select chevron stroke)
- Fonts and shell: `app/layout.tsx` (Albert Sans out, Newsreader in), `app/global-error.tsx` (hardcoded fallback palette)
- Metadata and assets: `public/manifest.json`, favicon, PWA icons, OG images, and `gsd-matrix.png`, all restored from the pre-Tidewater commit (`c3558da5~1`); `public/docs/codebase-analysis-report.html` hex-remapped
- Docs: `DESIGN.md` (rewritten for Editorial), `GSD-Design-Reference.html` (updated ink3 values)
- Tests: `tests/data/violet-frost-theme.test.ts` (now asserts the Editorial contract), `tests/ui/global-error.test.tsx`, `tests/ui/app-pages.test.tsx` (font mock)

## Keep out of the commits

`package.json`, `bun.lock`, and the `.agents/` CSV edits were dirty before this work started. They are unrelated. Leave them out.

## Steps

1. Review the diff group by group: tokens, globals, layout and fonts, global-error, tests, docs, public assets.
2. Rename the theme test: `git mv tests/data/violet-frost-theme.test.ts tests/data/editorial-theme.test.ts`. Nothing imports it; vitest finds it by glob.
3. Run the gates and fix any failure on-palette: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run quality:shape`, then `bun run test:e2e`. The theme contract test must pass as written.
4. Visual QA in `bun run dev`, light and dark. Check the matrix washes, header bands, and card spines. Check the dashboard Completion Trend: the dotted Created line must read clearly in dark mode. Check tide on buttons, links, and focus rings, Newsreader on display headings, the help drawer, and the favicon in the tab.
5. Sweep stale references. Update the Violet Frost mentions in `tests/ui/task-card-anatomy.test.tsx` (comment near line 96, describe near line 177) and `tests/e2e/touch-targets.spec.ts` (near line 86). Then run `grep -rni "violet\|frost\|albert" app components lib tests` and clean what remains. Leave `app/design-lab` alone; those pages are standalone experiments with their own CSS. Decide on `app/css/inkwell-theme.css`: globals.css does not import this vendored copy, so either sync it to the 1.4.0 values or mark its header stale.
6. Recapture screenshots if needed. `public/gsd-matrix.png` and `og-image.png` came back from the June commit, so they predate recurrence and anything else shipped since. If the gap shows, recapture both from the reskinned app at the same dimensions.
7. Commit in logical conventional commits matching history (`feat(theme): ...`). A reasonable split: the reskin, the test updates, the docs, and the tertiary-ink fix. Write commit messages and the PR body per vinny-voice (short version: active voice, no em dashes, no filler). Open a PR to main that includes the gate results. Flag the version question in the PR body: Tidewater took 11.0.0, so this restore may deserve 12.0.0. I will decide there.

## Acceptance

- All gates green, including e2e.
- `grep -rniE "5C4F7D|B95F5A|4D7A72|A99BCB|D88C86" app components lib tests public` returns nothing outside `app/design-lab`.
- `GSD-Design-Reference.html` stays byte-identical to the copy in the iOS repo at `gsd-iosapp/Design/`. If you touch it, mirror the change there.

## Out of scope

gsdtaskmanager.com and gsd-iosapp carry small uncommitted diffs from the same effort (tertiary-ink tokens and doc updates). They ship separately.
