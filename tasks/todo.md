# UI Polish Pass (/ui-craft polish) — 2026-08-16

Standard tier. Target: v9 single-matrix shell. CRAFT_LEVEL 7 → review.md
Polish Pass applied; signature ("quadrant stated twice") verified intact and
left as-built.

## Resuming From Here

Done (committed on `style/matrix-polish-pass`):
- capture-bar: "Details ↗" glyph → Lucide ArrowUpRightIcon; `n` hint span → kbd
- filtered-empty: rounded-[20px] → rounded-xl (token scale); clear button
  gains touch-target + focus-visible accent ring (a11y floor)
- task-card-actions: bare `transition` → `transition-opacity` on hover reveal
- quadrant-pane: tabular-nums on the "N more" / "N done" disclosure counts
- Gates green: 2780 tests, typecheck, lint

Next:
- Run /verify-frontend-change (browser check) before any push/PR — changes are
  class/markup-only and unit-covered, so this was deferred
- Push + PR only on user go-ahead
- Optional next rung: /finalize (pre-ship gate)

Assumptions:
- No version bump: package.json/sw.js already carry an uncommitted 12.0.1
  bump (deliberate leftover from a prior session); entangling it here would
  sweep unrelated changes into the polish commit

Blockers: none.

---

# Previous task: Publish gsd-mcp-server 1.2.4 (DONE)

Outstanding (user):
- REVOKE the npm token used 2026-08-16 on npmjs.com — it leaked into shell
  history/transcript during `gh secret set` (was passed as the secret name).
  Mint a replacement and `gh secret set NPM_TOKEN` before the next release.

Optional follow-up: switch to npm Trusted Publishing (OIDC) so the token
never expires again; requires npmjs.com config + bumping the workflow's
setup-node to Node 24 (npm ≥11.5 needed for OIDC).
