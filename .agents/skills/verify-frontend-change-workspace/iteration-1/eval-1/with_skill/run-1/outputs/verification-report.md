# Verification: Overdue indicator changed from left border-stripe to full border

Loop: dev (localhost:3001) · Browser: inspection-only (shared Chrome unavailable per constraints)
SW cache busted: N/A (no interactive browser; dev server runtime CSS confirmed independently)
Seeded: N/A (static analysis; no browser to inject IndexedDB)

---

## What I Did

### 1. Scoped the change

Read the skill first, then located the changed source. The change is in
`components/task-card/index.tsx` line 71.

**Before (commit prior to 8dd0f82):**
```
taskIsOverdue && "overdue-task border-l-[3px] border-l-status-overdue",
```
**After (current HEAD — commit 8dd0f82):**
```
taskIsOverdue && "border-status-overdue",
```

Acceptance criterion: overdue task cards should show a full all-sides 1.5px rust
border (`#B04A3F` light / `#D27468` dark) rather than a 3px left-only stripe.

### 2. Git/source verification

- Confirmed via `git diff HEAD -- components/task-card/index.tsx` that the file has
  **no pending local changes** — the change is cleanly committed.
- Confirmed `overdue-task` CSS class was removed from `app/globals.css` (grep finds
  zero occurrences). The old custom CSS rule is fully dead.
- Confirmed `border-l-status-overdue` appears in no source `.tsx`/`.ts`/`.css` file —
  the old class is not applied anywhere in the component tree.

### 3. Token chain verification

Traced `border-status-overdue` → `--color-status-overdue` → `--status-overdue` →
`--rust` → `#B04A3F` (light) / `#D27468` (dark) through:
- `app/globals.css` `@theme` block (line 206): `--color-status-overdue: var(--status-overdue)`
- `app/globals.css` (line 139): `--status-overdue: var(--rust)`
- `app/css/inkwell-tokens.css` (line 41): `--rust: #B04A3F` / dark override `#D27468`

This is a fully resolved, visible rust/red color — not transparent, not inheriting.

### 4. Border composition check

The `<article>` element in `TaskCardComponent` always has the `border` class (line 66,
unconditional). The `@utility border` override in `globals.css` (line 230) sets
`border-width: 1.5px`. The `border-status-overdue` class only sets `border-color`.
`twMerge` (used by `cn()`) treats `border` (width) and `border-status-overdue` (color)
as non-conflicting — both survive. `border-card-border` (also a color utility) **is**
overridden by `border-status-overdue` since they're in the same tailwind-merge group —
which is the intended behavior.

### 5. Live CSS from running dev server (partial runtime check)

Downloaded the generated CSS chunk served by the running dev server at `localhost:3001`:
`/_next/static/chunks/Projects_gsd-taskmanager_app_globals_0xmbyqa.css` (157,620 bytes).

Confirmed directly in the served CSS:

```css
/* Present — new behavior */
.border-status-overdue {
  border-color: var(--color-status-overdue);
}

/* Present — border override is in effect */
.border, .border-hair {
  border-width: 1.5px;
}
```

**Not present** in served CSS:
- `overdue-task` — no rule exists (confirmed: grep returns zero results)
- `border-l-[3px]` — no rule exists

The dev server is serving fresh code with the correct CSS. No stale build artifact
was found.

### 6. Unit test suite

Ran `bun run test -- tests/ui/task-card.test.tsx` — **17/17 tests pass**, including:

```
✓  applies overdue border styling for overdue tasks
```

The test explicitly asserts `expect(article).toHaveClass("border-status-overdue")` and
includes the comment "Overdue cards get a full rust hairline border (replaces the banned
side-stripe)". This test was written alongside the change in commit 8dd0f82 (TDD — test
written with implementation).

---

## Verification Dimensions

- **Functional (static):** PASS — Source is correct. `border-l-[3px] border-l-status-overdue overdue-task` is gone; `border-status-overdue` is the sole overdue class applied to the `<article>`. The base `border` (1.5px) utility is unconditional and never stripped.
- **CSS token chain:** PASS — `border-status-overdue` resolves to `#B04A3F` (light) / `#D27468` (dark) with no broken variable references.
- **Stale build check:** PASS — The dev server at localhost:3001 is serving a generated CSS file that contains `.border-status-overdue` and does NOT contain `.overdue-task` or `border-l-[3px]`. The `@utility border { border-width: 1.5px }` override is active.
- **Unit tests:** PASS — 17/17, including explicit `border-status-overdue` class assertion.
- **Console/network errors:** DEFERRED — No live browser available to read console output.
- **Visual (live screenshot):** DEFERRED — No interactive browser available per session constraints.

---

## Stale Build Trap Assessment

The user's concern is specifically about the stale-SW-chunk trap documented in the skill.
Key findings:

1. **No stale source:** The source file (`components/task-card/index.tsx`) has zero
   uncommitted changes. The change is in git.
2. **Dev server CSS is fresh:** The CSS chunk served by localhost:3001 already has
   `.border-status-overdue` and no remnants of the old stripe pattern.
3. **SW cache risk still exists for a real browser visit:** The service worker would need
   to be busted before a browser screenshot would be trustworthy. The skill's
   `scripts/reset-app-state.js` procedure must be run in the browser console before
   taking a live screenshot.

---

## Evidence

- Source: `/Users/vinnycarpenter/Projects/gsd-taskmanager/components/task-card/index.tsx` line 66–74
- CSS tokens: `/Users/vinnycarpenter/Projects/gsd-taskmanager/app/globals.css` lines 206–207, 230–232
- Token values: `/Users/vinnycarpenter/Projects/gsd-taskmanager/app/css/inkwell-tokens.css` line 41
- Served CSS (downloaded): `http://localhost:3001/_next/static/chunks/Projects_gsd-taskmanager_app_globals_0xmbyqa.css`
- Unit test: `/Users/vinnycarpenter/Projects/gsd-taskmanager/tests/ui/task-card.test.tsx` line 179–188
- Git commit: `8dd0f82` — "fix(matrix): keyboard drag-and-drop, Inkwell palette alignment, overdue de-clutter"

## Codified

No new E2E spec for overdue border styling currently exists in `tests/e2e/`.
This behavior is regression-worthy — a visual CSS regression would be silent in unit
tests if the class name changed without a test update.

**Recommended follow-up (not blocking this verification):** Add an E2E spec using
`tests/e2e/pages/matrix-page.ts` that creates an overdue task and asserts
`article[data-testid="task-card"].border-status-overdue` is present in the DOM.
This would catch future class-name regressions.

---

## Verdict

**PASS (static + partial runtime) — live visual confirmation DEFERRED**

The change is correct in source and in the live dev server's generated CSS. The old
left-stripe (`border-l-[3px] border-l-status-overdue overdue-task`) is completely
removed from source and from the served CSS. The new full-border (`border` + conditional
`border-status-overdue`) resolves to a visible 1.5px rust hairline on all four sides.
Unit tests confirm the class is applied.

**Before trusting a screenshot as proof, run `scripts/reset-app-state.js` in the browser
console and hard-reload** — the service worker will otherwise serve stale JS chunks, which
is exactly the trap the user flagged. The static evidence here is strong, but a visual
confirmation with SW cache busted is the final verification step for the "does it show
up in the matrix" question.
