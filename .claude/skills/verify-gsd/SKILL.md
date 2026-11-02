---
name: verify-gsd
description: Launch and drive a disposable production build of the GSD Task Manager web app (the PWA matrix, capture bar, search, Review, and backup) and prove behavior with screenshots, ARIA snapshots, and IndexedDB rows. Use when you need evidence that a feature works end to end from a clean browser, when you're proving a change to capture, tasks, search, Review, or import and export, or when a behavior depends on the production CSP or the service worker. Needs no API key and can't reach the live backend. For quick checks of a UI edit on the dev server, use verify-frontend-change instead.
---

# verify-gsd

This skill serves the static export the way production does, drives it with Playwright, and saves proof. Every journey starts from an empty browser profile, so the repo's two usual false passes can't happen: no service worker holds stale chunks, and the data a journey needs is either created or seeded by that journey.

Run every command from the repository root. In this skill and its feature map, `gsd-verify` means:

```bash
bash .claude/skills/verify-gsd/scripts/gsd-verify
```

Call it through `bash`. The owner's global settings deny `chmod`, so the file may not have its executable bit.

The surface is the web app. The feature map doesn't cover two other surfaces. The MCP server (`packages/mcp-server/`) speaks JSON-RPC over stdio, and a full-server probe needs `HOME` pointed at a scratch directory. Cloud sync needs a real sign-in against production, so mock it with `context.route` the way `tests/e2e/sync-auth-token.spec.ts` does.

## Launch

```bash
gsd-verify up
```

`up` runs in this order:

1. It refuses to start if this checkout already has a live instance.
2. It runs `bun run build:e2e`, unless `out/` already matches the current source. A build takes about 10 seconds, and a reuse takes about 2. Pass `--rebuild` to force one.
3. It copies `out/` to `$TMPDIR/gsd-verify/<digest of every file in out/>/` and serves the copy with `scripts/lib/static-export-server.cjs`, on the first free port from 3210 to 3229. Pass `--port N` to choose one.
4. It runs doctor, which includes loading the matrix in a real browser.

Ready means `up` exits 0 and prints `Ready: http://127.0.0.1:<port>`. An answering server isn't enough, so `up` stops the server and fails if the matrix doesn't load.

The server uses the production CSP and the deployed CloudFront rewrite function. A build rewrites `AGENTS.md` and `next-env.d.ts`, and `up` restores them when they were clean beforehand.

To run a second instance side by side, use a git worktree with its own `bun install`. `up` picks the next free port there. One checkout runs one instance, because `next build` and `next dev` both delete `out/` and `.next`. `up` refuses to build while a Next process runs in the same checkout.

## Doctor

```bash
gsd-verify doctor
```

Run this first whenever anything looks off. It changes nothing in the app, and it saves its own proof to the evidence folder. Exit 0 means the instance is worth driving. It checks that:

- the recorded pid is the export server, and that pid owns the port
- the served `sw.js` matches the snapshot, so the server is answering from this run's copy (the digest in the snapshot's name is what ties that copy to the build)
- the source still matches the build (a stale instance fails here, and `drive` refuses to run)
- the matrix loads with a clean console, the production CSP header is present, and the internet is blocked

## Drive

Each `journeys/*.journey.ts` file is a Playwright spec whose test titles are the sub-feature IDs in the feature map.

```bash
gsd-verify drive capture                      # every test in a journey
gsd-verify drive capture -g capture-submit    # one sub-feature
gsd-verify drive capture --headed             # watch it
```

Journeys: `capture`, `task-lifecycle`, `search`, `review`, `backup`, and `doctor`. Read [features/README.md](features/README.md) first, then the feature's file. It lists every entry point, and a proof that drives one entry point doesn't cover the others.

To prove something the journeys don't cover, write a file in `journeys/adhoc/`, which git ignores. End its name in `.journey.ts`, because Vitest collects any `*.spec.ts` in the repo, ignored or not, and fails the suite:

```ts
// .claude/skills/verify-gsd/journeys/adhoc/my-change.journey.ts
import { test, expect } from "../../harness/fixtures";

test("my-change", async ({ page, matrix, seed, proof }) => {
  await seed("matrix");                                  // optional precondition
  await matrix.createTask("Call the bank !!");           // tests/e2e/pages/matrix-page.ts
  await expect(page.getByTestId("quadrant-q1")).toContainText("Call the bank");
  await proof.capture("after-create");                   // screenshot + ARIA snapshot
  expect(await proof.rows("after-create")).toHaveLength(5); // IndexedDB rows, also saved
});
```

```bash
gsd-verify drive .claude/skills/verify-gsd/journeys/adhoc/my-change.journey.ts
```

These fixtures come from `harness/fixtures.ts`:

| Fixture | What it gives you |
|---|---|
| `matrix` | The repo's `MatrixPage` page object, already on the loaded matrix. |
| `seed(scenario)` | Writes `"matrix"`, `"dashboard"`, `"storage"`, `"trash"`, or a list of specs to IndexedDB, then reloads. Uses `tools/stagehand/page-scripts/seed-tasks.js`. |
| `proof` | `capture(name)`, `rows(name, store?)`, and `write(name, value)`. |
| `externalRequests` | Every off-origin URL the page requested in this test. |
| `firstVisit` | Set `test.use({ firstVisit: true })` to get the `/about` redirect and welcome tour. Other journeys skip both. |
| `expectedConsoleErrors` | Set `test.use({ expectedConsoleErrors: /pattern/ })` when a test causes a console error on purpose. |

Find selectors in the same order the e2e suite does: `data-testid`, then role and accessible name. Copy flows from `tests/e2e/*.spec.ts`, and if a behavior deserves a permanent regression test, move it there. See step 6 of the verify-frontend-change skill.

## Evidence

Everything lands in `.claude/verify-gsd-runs/<run>/evidence/`, which git ignores and cleanup keeps. `drive` prints the exact folder as its last line.

| Path | Contents |
|---|---|
| `build.log`, `server.log` | The build and the server. |
| `<journey>-<stamp>/<test>/<name>.png` | A screenshot taken after the page stops moving. |
| `<journey>-<stamp>/<test>/<name>.aria.txt` | The accessibility tree at the same moment. |
| `<journey>-<stamp>/<test>/<name>.<store>.json` | Rows read back from IndexedDB. |
| `<journey>-<stamp>/playwright/<test>/trace.zip` | Every action and the state after it. Open with `bunx playwright show-trace <path>`. |
| `<journey>-<stamp>/network.jsonl` | Every off-origin request. Privacy claims rest on this file. |
| `<journey>-<stamp>/console.jsonl` | Console errors and uncaught exceptions. |
| `<journey>-<stamp>/report.json`, `playwright.log` | Results and raw output. |

A proof meets these standards:

- It exercises the real user path: the capture bar, the keyboard, the file picker. Seeding only sets up a precondition, and it never proves the app can write that data.
- It captures the action and the resulting state, which the trace does for you.
- It checks the side effect as well as the screen. Reload and read the rows with `proof.rows`, and parse any download.
- It mocks only at a real boundary, which here means a third-party page or the backend. Mock with `context.route`, which answers before the DNS block applies.

The DNS block fails every hostname except `127.0.0.1` and `localhost` inside the browser process, so it also stops service worker requests that Playwright's routing can't see. The `internet-blocked` doctor test proves it against `api.vinny.io`, which the CSP allows. A journey fails on any `console.error` or uncaught exception, except the name-resolution errors that block causes. Those stay visible in `network.jsonl`, and `network.jsonl` doesn't list service worker requests.

Report your result with the template in the verify-frontend-change skill. Name the run folder, and say which entry points you drove and which you didn't.

## Cleanup

```bash
gsd-verify down
```

`down` stops the server pid recorded in the run, after confirming that pid is the export server. It never kills by process name, and it's safe to run twice. Run it after every failed attempt too. Browsers close when each drive ends.

Evidence stays. The helper also leaves the `$TMPDIR` snapshot in place, because it never deletes anything: the same build reuses it and macOS purges old temp files. The owner's settings deny `rm` to agents, so old run folders under `.claude/verify-gsd-runs/` stay until the owner removes them.

## Helpers

- `scripts/gsd-verify` has the `up`, `doctor`, `drive`, `down`, and `help` subcommands shown above.
- `playwright.config.ts` holds the Chromium project, the DNS block, and the evidence paths. It only runs through `gsd-verify`, which sets the environment it needs.
- `harness/fixtures.ts` holds the fixtures listed under Drive.

## Gotchas

- Chromium is the only browser here. For Firefox and WebKit, run `bun run test:e2e:export -- --project=webkit`.
- A production build hides React's dev-only warnings. Run `bun run test:e2e -- --project=chromium` to see them before shipping UI work.
- Don't trust a screenshot from `page.screenshot()` taken right after a navigation. On Review it showed Active tasks 2 and Completion rate 27% while the page settled on 4 and 50%, with the previous page ghosted behind it. `proof.capture` waits for identical frames and logs to `unsettled-captures.jsonl` if the page never stops moving.
- Don't filter `drive` output through a grep without checking the exit code. In zsh, an unquoted `$var` holding a command doesn't word-split, so the command never runs and the filter hides the error.
- Each build bumps the patch number in `.build-info.json`, which git ignores. It happens with any local `bun run build`.
- `MatrixPage.completeTask` waits for the title to disappear, so it times out on a recurring task, whose next instance keeps the title.
- If `up` reports a missing browser, run `bunx playwright install chromium`.
