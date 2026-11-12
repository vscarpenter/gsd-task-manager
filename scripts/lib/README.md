# scripts/lib

## Overview

This directory holds two CommonJS helpers that other scripts and the Playwright setup import. One serves the built `out/` folder the way production does. The other gives Firefox on macOS a temporary home folder during tests.

## Interface

- `static-export-server.cjs`
  - Command line: `node scripts/lib/static-export-server.cjs`. It takes no arguments. It reads the `PORT` environment variable (default `DEFAULT_PORT`, 3100). On a startup failure it prints the error and sets `process.exitCode = 1`.
  - `readProductionCsp()`: returns the policy string from `buildCsp('cloudfront')` in `config/csp.cjs`.
  - `resolveExportFile(outputRoot, requestUrl, headers)`: returns the absolute path of the file to serve.
  - `startStaticExportServer({ outputRoot, port = 0, csp })`: returns a promise of `{ server, rootUrl }`.
  - `serveProductionExport({ outputRoot, port })`: starts the server with the production policy.
  - The root `package.json` `start` script, `playwright.export.config.ts`, `scripts/verify-production-csp.cjs`, and `scripts/verify-production-pwa.cjs` use this file.
- `firefox-test-home.cjs`
  - `withFirefoxTestHome(browserName, runWithEnv, platform = process.platform)`: an `async` function. It calls `runWithEnv` and returns a promise of its result.
  - For `firefox` on `darwin`, the callback receives `{ CFFIXED_USER_HOME: <temp folder> }`. Otherwise it receives `undefined`.
  - `tests/e2e/fixtures/test-fixtures.ts` and `scripts/verify-production-pwa.cjs` use this file.

## Invariants

- `static-export-server.cjs:resolveExportFile` routes each request through `handler` from `cloudfront-function-url-rewrite.cjs`, so local rewrites match production.
- `static-export-server.cjs:resolveExportFile` falls back to `<outputRoot>/index.html` for a path outside `outputRoot`, a missing path, or a non-file.
- `static-export-server.cjs:startStaticExportServer` rejects when `<outputRoot>/index.html` is missing.
- `static-export-server.cjs` answers every request with status 200 and `Cache-Control: no-store`. It sets `Content-Security-Policy` only when the caller passes `csp`.
- `static-export-server.cjs:HOST` binds the server to `127.0.0.1` only.
- `firefox-test-home.cjs:withFirefoxTestHome` runs its cleanup in a `finally` block, so cleanup runs when the callback throws.

## Side Effects

- `static-export-server.cjs:startStaticExportServer` opens an HTTP server on `127.0.0.1`. It reads files under `outputRoot` on each request. It writes no files.
- `firefox-test-home.cjs:withFirefoxTestHome` creates a temp folder with `mkdtempSync` under `os.tmpdir()` (prefix `gsd-firefox-home-`). Afterwards it runs `/bin/chmod -R -N <folder>` on macOS and removes the folder with `rmSync`.

## Verification

- Run: `bun run test` (Vitest; `tests/data/static-export-server.test.ts` and `tests/data/firefox-test-home.test.ts` cover this directory)
