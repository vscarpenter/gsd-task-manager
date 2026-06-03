---
name: verify-frontend-change
description: Verify a frontend change actually works in the GSD Task Manager app before trusting it. Drives the running app browser-first — seeds IndexedDB, busts the PWA service-worker cache, then observes real behavior plus console/network errors — and codifies regression-worthy behavior as a Playwright spec. Use whenever you've edited a component, page, or any matrix/dashboard/settings/.tsx surface and need to confirm it renders and behaves correctly, especially before pushing or opening a PR. Critical for this repo: the service worker serves stale cached JS chunks and data surfaces render empty on a fresh load, so a naive screenshot produces false PASSes — use this skill to verify for real.
---

# verify-frontend-change

Confirm a frontend change does what it's supposed to **in the running app**, not just in your head. The output is a PASS/FAIL verdict backed by evidence — never a confident guess.

This skill exists because two traps in this codebase silently turn verification into theater:

1. **The service worker serves stale JS chunks.** You edit `border-l-4` → `border`, reload, and still see the old UI. Your screenshot "confirms" code that isn't running.
2. **Data surfaces render empty on a fresh load.** The dashboard and matrix have nothing to show until tasks exist. A screenshot of an empty dashboard "confirms" a layout you never actually saw.

Either trap produces a *false PASS* — the most dangerous outcome, because it ends the investigation with the wrong answer. Everything below is built to make PASS mean something.

**Right-size the effort.** The verification *is* the observation of the running change — the rendered result, the click working, the console staying clean. Static checks (`typecheck`, the unit suite) are a cheap *precondition*, not the verification, and they don't need to balloon: run the few that bear on *this* change, not the whole app. A CSS spacing tweak doesn't warrant the full test suite or a fresh Playwright run; it warrants eyes on the rendered card. Spending twenty minutes on static analysis to avoid two minutes of looking is the over-engineering this skill is meant to replace.

## When to use

Use this after editing any `.tsx`/`.jsx` under `components/` or `app/`, or any change that affects what the user sees or does — the matrix, capture bar, edit drawer, dashboard, settings, task cards. Reach for it before pushing or opening a PR on UI work.

Don't use it for backend/sync-only logic (`lib/sync/**`), pure data transforms with unit-test coverage, or styling-only token tweaks already covered by `inkwell-retrofit` — those have better-fit verification.

## Default dimensions

Verify these two by default — they catch the most regressions per unit of effort:

- **Functional behavior** — does the change do what the acceptance criteria say? The "did it actually work" check.
- **Console & network errors** — runtime errors, failed requests, and React warnings a screenshot can't show.

Accessibility and visual/Inkwell fidelity are **opt-in escalations** (see below), not part of every run. Add them when the change is a11y-sensitive (new interactive element, focus flow) or visually significant (new layout, color, spacing) — or when asked.

## The flow

### 1. Scope the change

Identify which surface(s) changed and what "correct" means. Pull the acceptance criteria from the task/spec/PR if they exist; if they don't, state in one line what behavior you're about to confirm. Pick the verification altitude — a one-line copy fix needs a glance; a new interaction needs the full loop.

### 2. Pick the loop

- **`bun dev`** (localhost:3000) for normal visual/behavioral checks. Fast feedback.
- **`bun run build && bun start`** when the change touches the service worker, PWA manifest, caching, or anything that only manifests in a production build. Dev mode won't surface those.

If a dev server is already running, reuse it.

### 3. Get a trustworthy render — bust the service worker

**Before trusting anything you see**, clear the cached chunks. Paste `scripts/reset-app-state.js` into the page console (via the browser's JS tool), then hard-reload. This unregisters every service worker and deletes the `gsd-*` Cache API entries, so the next load pulls fresh code from the dev server.

IndexedDB survives this — it's separate from the Cache API — so any seeded data persists across the reset. If you skip this step, assume every screenshot is suspect.

### 4. Seed state — if the surface is data-dependent

The dashboard and matrix render empty with no tasks, so there's nothing to verify on a fresh load. Inject realistic data straight into IndexedDB with `scripts/seed-tasks.js` instead of clicking through the capture bar — it's faster and deterministic.

Key facts the seeder encodes so you don't have to:

- Writes go straight to `objectStore.put()`, which **bypasses Zod** — so the seeder sets *every* field (including `tags: []`, `subtasks: []`, `timeEntries: []`), because a missing array crashes components that map over it.
- `quadrant` is **derived** from `urgent`+`important` and stored denormalized — the seeder computes it with the real resolver so tasks land in the right cell.
- **Analytics bucket by `updatedAt`, not `completedAt`** — completed-today counts, streaks, and trends all key off the `updatedAt` date. To make a task count as "done Tuesday," set `updatedAt` to Tuesday.
- Seed ids are prefixed `seed-` so cleanup removes only seeded tasks and leaves your real dev data alone. Run `gsdSeed.clear()` when done.
- Seed the *specific* state your change depends on — an overdue task for overdue styling, a completed history for streaks, a running timer for time analytics. Verifying a conditional style against data that never triggers it proves nothing.

The script ships ready-made scenarios (`gsdSeed.dashboard()`, `gsdSeed.matrix()`) — read its header for the full field map and how to build custom specs. Seed *before* you reload to view the data: navigation wipes the `window.gsdSeed` helper (the seeded rows in IndexedDB survive), so re-paste the script before calling `gsdSeed.clear()` afterward.

### 5. Observe — functional behavior + console/network

Drive the app to the changed surface and exercise the behavior. Capture evidence for each default dimension:

- **Functional**: perform the action the change enables and confirm the result. A screenshot of the relevant state is good evidence; describing the before/after transition is better.
- **Console**: read console messages and confirm no new errors/warnings were introduced by the change. Filter to app logs if output is noisy.
- **Network**: for changes that fetch/sync, confirm requests succeed and no unexpected calls fire.

If you used a real browser, name the evidence (screenshot path, the console output, the network entries). Evidence you can't point to didn't happen.

### 6. Codify — only if the behavior is regression-worthy

Browser observation is cheap and ephemeral. A Playwright spec is durable and CI-enforced — but it costs more to write, so reserve it for behavior worth defending against future regressions (a bug you just fixed, a core interaction).

When it clears that bar, extend the existing harness rather than inventing a new pattern:

1. Add/extend a flow method on `tests/e2e/pages/matrix-page.ts` (page-object model — specs read like a story).
2. Write the spec using the `clearIndexedDB` fixture; create tasks with the capture-parser shorthand (`task !!` → Q1, `task *` → Q2, `task !` → Q3, `task` → Q4; `#tag` adds a tag).
3. Run it once — it should fail with "selector not found" if you need a new `data-testid`. Add the `data-testid` to the component *with* the test, then re-run to green.
4. `bun run test:e2e -- --project=chromium` before considering it done.

Read `tests/e2e/README.md` for the full conventions (no `waitForTimeout` for state, testid discipline).

### 7. Report

Close with the verdict and its evidence (template below). State which dimensions you checked and which you didn't — an unchecked dimension is a known gap, not an implied PASS.

## If you don't have a live browser — degrade, never fake

A real browser (and dev server) may not be available — for example, in a spawned subagent, headless CI, or a sandbox. Walk down this ladder and **report which rung you reached**:

1. **Live browser** — the full flow above. Best evidence.
2. **Served-artifact check** — fetch the actual chunk the dev server returns (the CSS/JS under `/_next/...`) and grep for the new code *and the absence of the old*. This answers "am I looking at stale code?" without a browser — it's the cheapest way to defeat the stale-chunk trap when you can't bust the SW visually. Pair it with a targeted `bun run test:e2e` spec for real behavior in a real engine (one spec, not the whole suite — see right-sizing above).
3. **Static reasoning + deferral** — read the changed code, reason about behavior, and produce the verification *plan* (which surface, what to seed, what to click, what would prove it) — then explicitly defer execution: "Verified by inspection; runtime check pending — run steps 3–5 in a browser."

Never present a lower rung as if it were rung 1. **DEFERRED beats a PASS you can't back.** The subtle failure mode isn't faking a screenshot — it's *arguing your way to a PASS* ("the build system is self-healing, so it must be fine") instead of observing the result. When you haven't seen the change run, name the dimension you couldn't verify and defer it. A plan is not a PASS.

## Optional escalations

- **Accessibility** — when the change adds/alters interactive elements, focus flow, labels, or contrast, hand the changed `.tsx` files to the `a11y-reviewer` agent (WCAG AA baseline, read-only). Fold its findings into the report.
- **Visual / Inkwell fidelity** — when the change is visually significant, check it against the Inkwell system: 1.5px hairlines, the four-color quadrant language, spacing, and **both light and dark mode** (toggle via theme). The `ui-ux-pro-max`/`inkwell-retrofit` skills carry the design detail.

## Verification report format

Keep it short and evidence-first:

```
## Verification: <change in one line>

Loop: dev | build · Evidence rung: live | served-artifact+playwright | inspection-only
SW cache busted: yes/no/n-a · Seeded: yes (scenario) / no

- Functional: PASS/FAIL — <what you did, what you saw>
- Console/network: PASS/FAIL — <errors found, or "clean">
- [Accessibility]: PASS/FAIL — <a11y-reviewer summary>   (if escalated)
- [Visual]: PASS/FAIL — <light/dark notes>                (if escalated)

Evidence: <screenshot paths / console excerpt / spec name>
Codified: <spec path, or "no — not regression-worthy">
Verdict: PASS / FAIL / DEFERRED (runtime check pending)
```

## Gotchas

Living list — add failure points as you hit them.

- **Stale chunks survive a dev-server restart.** Restarting `bun dev` doesn't clear the SW cache; only step 3 does. If the old UI persists after a code change, you skipped the bust.
- **`localStorage.clear()` is a no-op in jsdom-under-Bun** — irrelevant in a real browser, but don't rely on it inside tests for state reset; use the `clearIndexedDB` fixture.
- **First visit redirects to `/about`.** A fresh origin lands on the about page before the matrix; navigate explicitly or seed past it.
- **`!important` in a capture string is a literal word, not an urgency flag** — tokens must be space-bounded (`task !!`), or the task silently lands in Q4.
