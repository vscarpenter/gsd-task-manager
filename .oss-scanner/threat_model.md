# Threat model

GSD Task Manager is a privacy-first Eisenhower matrix task manager served at https://gsd.vinny.dev. The web app is a Next.js static export with no server rendering, and tasks live in the browser's IndexedDB. Optional cloud sync talks to one PocketBase server: the hosted service at https://api.vinny.io, or the self-host image under `docker/`. The npm package `gsd-mcp-server` (`packages/mcp-server/`) lets an AI assistant read and write a user's synced tasks.

## What this project does and where untrusted input enters

The product promise has two halves. In local-only mode, task content never leaves the browser, and the only outbound request is feedback the user chooses to send. With sync on, task content goes only to the configured PocketBase server, and each account reaches only its own tasks.

Untrusted input enters in these places:

- The PocketBase API, from the internet. Signed-in users read and write records in `tasks` under owner-scoped collection rules from `scripts/setup-pocketbase-collections.sh`, and an update can't change `owner`. Anyone can create a record in `feedback`, a write-only collection guarded by hooks.
- Custom hook routes in `docker/pb_hooks/`. `GET` and `POST /api/gsd/oauth-callback` are unauthenticated and bounce a provider's return to the web callback page. `DELETE /api/gsd/sessions` and `DELETE /api/gsd/account` require a signed-in user. `GET /api/gsd/feedback-controls` requires a superuser. A router middleware blocks PocketBase's `/api/oauth2-redirect`.
- The OAuth return in the browser. `/auth/callback/` reads `code`, `state`, and `error` from the URL fragment and relays them over a same-origin `BroadcastChannel` (`lib/sync/oauth-callback.ts`). Only the tab that holds the matching state and PKCE verifier exchanges the code. Providers are Google, GitHub, and Apple.
- Synced data. `lib/sync/` pulls records and realtime (SSE) events and validates them with Zod in `lib/sync/task-mapper.ts` before writing IndexedDB.
- Imports. JSON backups go through `importPayloadSchema` in `lib/schema.ts` and `lib/tasks/import-export.ts`, capped at 10 MB and 10,000 records across tasks, archive, and trash.
- Web capture. Bookmarklets open `/#action=capture&title=…&url=…&tags=…`. `lib/share-capture.ts` parses the fragment, keeps only http and https URLs, and opens a draft that isn't saved until the user selects Create task. The page title comes from whatever site the user was on.
- Task descriptions. `lib/task-links.ts` turns http and https URLs into links, and `components/task-description.tsx` renders them with `rel="noopener noreferrer"`. No app code uses `dangerouslySetInnerHTML`.
- The MCP server. It reads `GSD_POCKETBASE_URL` and `GSD_AUTH_TOKEN` from its environment and takes tool arguments from an AI assistant. Treat every argument as untrusted. Task text can arrive from web capture, so it may carry instructions aimed at the assistant.

## Components that matter most / least

These matter most:

- `docker/pb_hooks/`, `scripts/setup-pocketbase-collections.sh`, and `scripts/setup-pocketbase-feedback-collection.sh`. Together they are the server's access control: owner isolation, the OAuth bounce, session revocation, account deletion, and the feedback abuse controls.
- `docker/pb_hooks/encryption-core.js`, `docker/pb_hooks/tasks_encryption.pb.js`, and `docker/pb_migrations/`. They encrypt task content at rest in the self-host image. The hosted service doesn't run them (ADR 0016).
- `config/csp.cjs`, which generates the CSP for CloudFront and for `docker/Caddyfile`, plus `cloudfront-function-response-headers.cjs` and `cloudfront-function-url-rewrite.cjs`.
- `lib/sync/`, especially sign-in, the OAuth callback, push, pull, realtime, and token handling.
- `lib/schema.ts`, `lib/tasks/import-export.ts`, `lib/share-capture.ts`, and `lib/task-links.ts`.
- `public/sw.js` and `lib/sw-cache-logic.ts`, which decide what the app caches and serves offline.
- `packages/mcp-server/src/`, especially URL validation in `server/config.ts`, filter building in `write-ops/helpers.ts`, and the write operations and their rate limiter.

These matter least:

- `docs/`, `public/docs/` (static reports), `tools/`, and the tests themselves.
- Deploy and release scripts under `scripts/`, which the maintainer runs with their own credentials. Treat their inputs as trusted. The exceptions are the PocketBase setup scripts above and the build steps that shape production output, such as `scripts/externalize-inline-assets.cjs`.
- Third-party dependencies. Please report their bugs upstream. How this project configures and calls them is in scope.

## How to exercise it

The image has Node 22, Bun, the locked dependencies, and Playwright's Chromium, Firefox, and WebKit builds. It also holds the built static export in `out/`, the MCP server build in `packages/mcp-server/dist/`, PocketBase 0.40.4 at `$POCKETBASE_BIN`, and PocketBase 0.26.6 at `$POCKETBASE_OLD_BIN`. Everything below runs offline.

- `bun run test` runs the Vitest suite. Use it rather than `bun test`, which starts Bun's own runner.
- `bun run --cwd packages/mcp-server test -- src/__tests__/system --no-file-parallelism` runs the PocketBase system tests. They start PocketBase on 127.0.0.1 with `docker/pb_hooks`, run both collection setup scripts, and drive real requests. Coverage includes the OAuth bounce, feedback, owner isolation, session revocation, ciphertext at rest, and browser sync. `pocketbase-system.test.ts` is the best template for standing up a server to probe.
- `bun run --cwd packages/mcp-server test` runs the MCP server tests. Because the image sets `POCKETBASE_BIN`, that run includes the system tests too.
- The binaries live under `/tmp`, as they do in CI. PocketBase treats a binary under the temp folder as a development run and logs its SQL, and the upgrade test asserts on that log. Copy a binary elsewhere and that one assertion fails.
- `bun run test:e2e -- --project=chromium` runs Playwright against the dev server. Offline, the dev server logs a failed fetch from `fonts.googleapis.com`. That's expected, and the tests still pass.
- `bun run test:e2e:export -- --project=chromium` runs the critical journeys against the built `out/` under the production CSP. `bun run test:csp` boots the export under that same CSP.
- Don't use `bun run test:system:pocketbase` or `bun audit` offline. The first downloads PocketBase before testing, and the second queries npm.
- Playwright sizes its worker pool from the CPU count Node reports, and inside a container that count can exceed the two CPUs a scan gets. Pass `--workers=1` if browser tests time out.

## How you rate severity

Critical:

- One account reads, changes, or deletes another account's tasks, or changes a task's owner.
- An attacker signs in as a victim, or captures a victim's authorization code or auth token.
- Script runs on the app origin from content an attacker controls: a task field, an import file, a capture link, or synced data. Script there can read IndexedDB and the auth token in `localStorage`.
- Task content, tokens, or credentials leave the device in local-only mode, or reach any host other than the configured PocketBase server with sync on.
- The MCP server leaks the auth token or sends it to a host other than the configured server.

High:

- Anyone can read feedback, write fields beyond its seven allowed keys, or get around its abuse controls.
- Sign out of all devices leaves a working session, or account deletion leaves the account's tasks behind.
- The self-host image stores task content in plaintext, or a migration can corrupt or downgrade encrypted fields.
- A production page can be framed, ships without its security headers, or runs inline script despite the CSP.
- An MCP tool argument escapes the PocketBase filter escaping, or a tool writes more than it says it will.

Medium:

- Denial of service against the PocketBase routes that gets around their rate limits.
- A crafted import or synced record that breaks the app until the user clears their data.
- The service worker serves stale or attacker-influenced content, or keeps capture data it should drop.
- Text from a captured page steers the assistant, through the MCP server, into a write the user didn't ask for.

Low:

- Self-XSS that requires victims to paste the payload themselves.
- Issues that need a malicious PocketBase server, unless they lead to script running in the web app.
- Missing hardening with no demonstrated impact.

## Anything to leave alone

`SECURITY.md` documents these trade-offs, so please don't report them as new findings:

- The PocketBase SDK keeps the auth token in `localStorage`. A way to read it is in scope. Where it lives isn't.
- The hosted service stores task content in plaintext. ADR 0016 records why the encryption hooks aren't deployed there.
- Commit `e9230cb` holds an expired PocketBase token. Report it only with evidence that the credential still works.
- The `braces` advisory is accepted for dev-only tooling until 2027-01-05.
- `style-src-elem 'unsafe-inline'` and `style-src-attr 'unsafe-inline'` are deliberate. `SECURITY.md` explains why and bounds the risk.

Reports help most when they include a failing Vitest or system test that reproduces the issue. A patch should keep the existing tests green, validate new input with Zod, and keep sync behind owner-scoped rules.
