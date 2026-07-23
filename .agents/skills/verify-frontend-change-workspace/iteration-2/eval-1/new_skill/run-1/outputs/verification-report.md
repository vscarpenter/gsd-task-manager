## Verification: overdue indicator changed from border-l-4 (left stripe) to full border on task cards

Loop: dev (localhost:3001 already running) · Evidence rung: served-artifact + unit test
SW cache busted: n/a (no browser session; artifact fetched directly from dev server)
Seeded: no (unit tests use in-memory rendering; artifact check is structural, not data-dependent)

---

### What changed

In `components/task-card/index.tsx` (commit `8dd0f82`), the overdue styling on task cards was changed from a left-only border stripe to a full border:

| Before | After |
|--------|-------|
| `taskIsOverdue && "overdue-task border-l-[3px] border-l-status-overdue"` | `taskIsOverdue && "border-status-overdue"` |

The base `border` class was already present on line 66 (`"group relative flex flex-col gap-2 rounded-xl border bg-card p-3 ..."`), meaning `border-status-overdue` adds a rust-colored border on all four sides by setting `border-color`, while the pre-existing `border` class provides `border-width: 1px` all around. The old implementation applied a 3px left-only stripe.

---

### Verification steps performed

#### 1. Source code inspection
- Read `components/task-card/index.tsx` — confirmed `border-status-overdue` is present on line 71, `border` base class is on line 66.
- Confirmed no `border-l-[3px]`, `border-l-status-overdue`, or `overdue-task` anywhere in the component tree (`grep` across all `.tsx`/`.css`).
- Confirmed the `--color-status-overdue` token resolves to `var(--rust)` (warm rust color) in `app/globals.css`.

#### 2. Unit test run
Ran the targeted test suite:
```
bun run test -- --reporter=verbose tests/ui/task-card.test.tsx
```
Result: **17/17 PASS** — including both:
- `"applies overdue border styling for overdue tasks"` — asserts `expect(article).toHaveClass("border-status-overdue")` ✓
- `"does not show overdue warning for completed tasks"` — confirms the guard `!task.completed` prevents false positives ✓

The test comment is explicit: *"Overdue cards get a full rust hairline border (replaces the banned side-stripe)."*

#### 3. Served-artifact check (stale-chunk defense)
Dev server was running at `http://localhost:3001`. Fetched the served JS chunk that contains the task card component (`Projects_gsd-taskmanager_011mdy8._.js`):

```
curl -s "http://localhost:3001/_next/static/chunks/Projects_gsd-taskmanager_011mdy8._.js" \
  | grep -o "border-status-overdue|border-l-\[3px\]|border-l-status-overdue|overdue-task"
```

- `border-status-overdue` — **found (1 occurrence)** ✓
- `border-l-[3px]` — **absent** ✓
- `border-l-status-overdue` — **absent** ✓
- `overdue-task` — **absent** ✓

Also fetched the served CSS chunk (`Projects_gsd-taskmanager_app_globals_0xmbyqa.css`):
- `.border-status-overdue { border-color: var(--color-status-overdue); }` — **present** ✓
- `--color-status-overdue: var(--status-overdue)` — **defined** ✓
- No `border-l` overrides or `overdue-task` rules — **confirmed absent** ✓

The dev server is serving the updated code, not a stale build. The stale-chunk trap is ruled out.

#### 4. CSS semantics check
The `.border-status-overdue` rule sets only `border-color`. The actual border visibility depends on the base `border` class being applied first. Confirmed the base `border` is on line 66 (always present on every task card). Therefore, when `taskIsOverdue` is true, all four sides of the card get the rust `border-color`, producing a full-perimeter border callout — not a left stripe.

---

### Dimensions covered

- **Functional** (structural): PASS — class is present in source, present in served chunk, and asserted in passing unit test.
- **Console/network**: NOT CHECKED — no browser session available; this dimension is deferred.
- **Accessibility**: NOT ESCALATED — the change is a visual border treatment, not an interactive element; no a11y escalation warranted.
- **Visual / Inkwell fidelity**: PARTIALLY CHECKED — token resolves correctly to the rust color; full light/dark mode visual check deferred (requires browser).

---

### Evidence

- Source file: `components/task-card/index.tsx` line 66 (`border`), line 71 (`border-status-overdue`)
- Commit: `8dd0f82` — diff shows exact `border-l-[3px] border-l-status-overdue` → `border-status-overdue` change
- Test run: `tests/ui/task-card.test.tsx` — 17/17 PASS including `"applies overdue border styling for overdue tasks"`
- Served chunk `Projects_gsd-taskmanager_011mdy8._.js` — `border-status-overdue` present, old classes absent
- Served CSS `Projects_gsd-taskmanager_app_globals_0xmbyqa.css` — `.border-status-overdue { border-color: var(--color-status-overdue); }` confirmed; `--color-status-overdue: var(--status-overdue)` confirmed

Codified: `tests/ui/task-card.test.tsx` — test `"applies overdue border styling for overdue tasks"` at line 179 already defends this behavior.

---

**Verdict: PASS** (with one deferred dimension)

The change is live in the served code — not stale. The old left-stripe classes are gone. The new full-border approach works correctly: the base `border` class provides width on all sides, and `border-status-overdue` applies the rust color. Unit test confirms the behavior. The only unchecked dimension is a live-browser console/network check and a visual dark-mode inspection, which require a browser session.
