# scripts

## Overview

This directory holds the build, deploy, quality-gate, verification, and PocketBase setup scripts for the web app. Several scripts change production systems (S3, CloudFront, PocketBase, GitHub labels). Read Side Effects before you run one.

Shared helpers live in [lib](./lib/README.md).

## Interface

Each entry gives the usage, the environment variables the script reads, and the exit codes it sets.

### Build

- `build-static-export.sh`: `bash scripts/build-static-export.sh`. No arguments. It sources `.build-env.sh` from the repo root. It exits 1 when `out/index.html` is missing or empty.
- `build-local.sh`: `bash scripts/build-local.sh`. No arguments. It exports `NEXT_DISABLE_SWC_BINARY=1` and `NEXT_CACHE_DIR`, then runs `npm run build`.
- `generate-build-info.cjs`: `node scripts/generate-build-info.cjs`. No arguments, no exports. The root `build` script runs it first.
- `update-sw-version.cjs`: `node scripts/update-sw-version.cjs <path to sw.js>`. It exits 1 on any error. It exports `CACHE_VERSION_PLACEHOLDER` and `stampCacheVersion(source, version)`. `resolveVersion` takes the stamped version from `.build-info.json` and falls back to `package.json`.
- `externalize-inline-assets.cjs`: `node scripts/externalize-inline-assets.cjs [outputDirectory]` (default `out`). It exports `externalizeInlineAssets(outputDirectory)` and `isExecutableScript(attributes, body)`. `externalize-inline-assets.d.cts` declares both types.
- `generate-sw-cache-logic.cjs`: `node scripts/generate-sw-cache-logic.cjs`. It exports `generateSwCacheLogic(typescriptSource)`.

### Deploy

- `deploy-prod.sh`: `scripts/deploy-prod.sh`. No arguments. It sets `S3_BUCKET`, `CLOUDFRONT_ID`, `ENV_LABEL`, and `SITE_URL` to hard-coded production values, runs `npm run build`, then runs `deploy-app.sh` with `exec`.
- `deploy-app.sh`: `scripts/deploy-app.sh`. No arguments. It requires `S3_BUCKET`, `CLOUDFRONT_ID`, `ENV_LABEL`, and `SITE_URL`. It reads `GITHUB_OUTPUT` when set. It exits 1 when `./out` is missing.
- `deploy-cloudfront-function.sh`: no arguments. It requires `CLOUDFRONT_DISTRIBUTION_ID`. It reads `AWS_REGION` (default `us-east-1`). It exits 1 when `aws`, `jq`, `node`, or a function source file is missing.
- `deploy-cloudfront-response-headers-policy.sh`: no arguments. It requires `CLOUDFRONT_DISTRIBUTION_ID`. It reads `POLICY_NAME` (default `gsd-security-headers`) and `AWS_REGION`. It exits 1 when the distribution does not reference the applied policy. It also exits 1 when `aws` or `jq` is missing or the policy file is absent.
- `fix-discovery-content-types.sh`: `scripts/fix-discovery-content-types.sh s3://bucket-name`. The bucket argument is required.

### PocketBase

- `setup-pocketbase-collections.sh`: no arguments. It requires `PB_ADMIN_EMAIL` and `PB_ADMIN_PASSWORD`. `PB_URL` is optional and defaults to the production PocketBase URL. It exits 1 on missing credentials, a missing tool, a failed sign-in, or a failed create.
- `setup-pocketbase-feedback-collection.sh`: no arguments. Same three variables. It exits 1 when any request or check fails.
- `update-pocketbase-tasks-schema.sh`: no arguments. Same three variables. It exits 1 when a required field, validator, or rule clause is missing after the update.
- `verify-pb-encryption.sh`: `PB_BIN=/path/to/pocketbase ./scripts/verify-pb-encryption.sh`. It reads `PB_BIN` (default `./pocketbase`), `PB_ADMIN_EMAIL`, and `PB_ADMIN_PASSWORD`. It exits 1 on any failed check.
- `verify-pb-encryption-remote.sh`: no arguments. It requires `PB_URL`, `PB_ADMIN_EMAIL`, and `PB_ADMIN_PASSWORD`. It exits 1 on any failed check.
- `run-pocketbase-system-test.sh`: no arguments. It reads `TMPDIR`. It exits 1 on an unsupported platform or a checksum mismatch. The root `test:system:pocketbase` script runs it.

### Quality gates

- `check-code-shape.cjs`: `node scripts/check-code-shape.cjs [--print-baseline]`. It exits 1 on a ratchet failure. It exports `analyzeCodeShape()`, `compareCodeShape(baseline, current)`, `measuredValue(message)`, and `validateDebtLedger(ledger, current, now)`. The root `quality:shape` script runs it. It reads `code-shape-baseline.json` and `code-shape-debt.json`.
- `check-bundle-budget.cjs`: `node scripts/check-bundle-budget.cjs [--write-baseline]`. It exits 1 on a budget failure. It exports `measureFirstLoad(outDir)`, `compareBundleBudget(budget, current)`, and `toBaseline(current, allowanceBytes)`. The root `quality:bundle` script runs it. It reads `bundle-budget.json`.
- `check-dependency-licenses.cjs`: `node scripts/check-dependency-licenses.cjs [--policy <path>] [--root <dir>]... [--sbom <path>]`. It sets exit code 1 on a violation. The root `license:check` script runs it. It reads `license-policy.json` by default. With no `--root`, it scans `node_modules` and `packages/mcp-server/node_modules` under the current directory. It throws on an unknown or incomplete argument. The file calls `main()` on load with no `require.main` guard.
- `check-audit-results.cjs`: `node scripts/check-audit-results.cjs <audit-results.json>`. Exit 0 means no blocking advisory, 1 means at least one, 2 means an input error. It exports `analyzeAuditResults(raw, { now })` and `runCli(resultPath, options)`.
- `bun-test-guard.cjs`: a preload listed in `bunfig.toml`. It has no arguments and no exports.
- `test-coverage.sh`: no arguments. It exits 1 when `coverage/` is missing. Otherwise it exits with the test run's status.
- `branch-preflight.sh`: no arguments. It exits 0 when all three checks are clean and 1 otherwise.

### Verification

- `verify-production-csp.cjs`: `node scripts/verify-production-csp.cjs`. No arguments. It sets exit code 1 on any error. The root `test:csp` script runs it.
- `verify-production-pwa.cjs`: `node scripts/verify-production-pwa.cjs [chromium|firefox|webkit ...]`. The default is all three browsers. It exports `isExpectedOfflineDiagnostic`. The root `test:pwa` script runs it.
- `verify-static-export-artifact.py`: `verify-static-export-artifact.py ARCHIVE OUTPUT_DIR`. It returns 2 on a wrong argument count, 1 on an unsafe or unreadable archive, and 0 on success.
- `smoke-test.sh`: `SITE_URL=<base-url> scripts/smoke-test.sh`. `SITE_URL` is required. It exits 1 on the first failed check.
- `tlc.sh`: `bash scripts/tlc.sh SPEC.tla CONFIG.cfg`. It reads `JAVA`, `GSD_TLC_CACHE`, `XDG_CACHE_HOME`, `HOME`, and `TMPDIR`. It exits 2 on a usage error, a missing file, a jar hash mismatch, or no Java. Otherwise it passes TLC's status through: 0 pass, 11 deadlock, 12 invariant, 13 temporal, 150 or more for a parse error.

### Automation helpers

- `triage-run.sh`: `triage-run.sh [--dry-run|--check]`. Both flags change nothing. Any other argument exits 2. It reads `GSD_TRIAGE_REPO`, `GSD_TRIAGE_SOURCE`, `GSD_TRIAGE_LOG_DIR`, `GSD_TRIAGE_HELPER`, and `GSD_TRIAGE_BOT_LOGIN`. `GSD_TRIAGE_REPO` and `GSD_TRIAGE_SOURCE` each fall back to a hard-coded value. The log and helper defaults are paths under the source path.
- `builder-run.sh`: `builder-run.sh [--dry-run|--check]`. Any other argument exits 2. It prints a `DISABLED` line and exits 0.
- `setup-labels.sh`: no arguments. It uses the signed-in `gh` command and the repo of the current directory.
- `failing-agent-prs.cjs`: reads a JSON array of pull requests on stdin and prints a count. It reads `GSD_TRIAGE_BOT_LOGIN`. It exports `isAgentBranch`, `isValidHeadSha`, `isTrustedProvenance`, `isFailingCheck`, and `failingAgentPRs(prs, botLogin)`.
- `extract-run-tokens.cjs`: reads JSON on stdin and prints `<tokens> <pr|none>`. It exports `extractRunTokens(json)`, `totalTokens(usage)`, and `parsePr(resultText)`.
- `parse-risk-tier.cjs`: library only. It exports `parseRiskTier(body)` and `RISK_TIERS`.
- `prev-release-tag.cjs`: library only. It exports `prevReleaseTag(currentVersion, tags)`.
- `telemetry-metrics.cjs`: library only. It exports `computeMetrics(input)` and `percentile(sorted, p)`.

### Config files

- `bundle-budget.json`: keys `allowanceBytes` and `routes`.
- `code-shape-baseline.json`: keys `complexity`, `max-depth`, `max-lines`, and `max-lines-per-function`.
- `code-shape-debt.json`: keys `owner`, `deadline`, `policy`, `maximumRemainingViolations`, and `resolvedTargets`.
- `license-policy.json`: keys `allowedLicenses` and `packageExceptions`.

## Invariants

- `deploy-app.sh` does not build. Its header says the release workflow verifies an attested artifact first, and `deploy-prod.sh` runs the build.
- `deploy-app.sh` runs in this order: immutable asset sync, HTML and service worker sync, `theme-init.js` upload (skipped when the build has no such file), `index.html` metadata, discovery content types, invalidation.
- `deploy-app.sh` passes `--no-follow-symlinks` to both syncs.
- `deploy-cloudfront-function.sh` runs `node --check` on both function files before any AWS call.
- `deploy-cloudfront-function.sh` passes `--if-match` with the current ETag to `update-function`, `publish-function`, and `update-distribution`.
- `deploy-cloudfront-response-headers-policy.sh` checks the policy JSON with `jq -e .` before it sends it. It verifies the attachment and does not attach the policy.
- `setup-pocketbase-collections.sh` always posts a new collection. It has no existence check, and it exits 1 only when the response has no `id`. A second run fails only if the server refuses the duplicate.
- `setup-pocketbase-collections.sh` sets owner-scoped rules. Its `updateRule` also keeps `owner` unchanged.
- `setup-pocketbase-feedback-collection.sh` enables public creation only after it verifies the hook, the rate limit, the quota, the retention, and the log settings. It requires `hookVersion == 2` from the controls route before the settings change and `ready == true` after it. Its constants are `FEEDBACK_RATE_MAX=30`, `FEEDBACK_RATE_SECONDS=60`, `FEEDBACK_MAX_RECORDS=10000`, and `FEEDBACK_RETENTION_DAYS=180`.
- `setup-pocketbase-feedback-collection.sh` requires `listRule`, `viewRule`, `updateRule`, and `deleteRule` to stay null.
- `update-pocketbase-tasks-schema.sh:ensure_field` appends a field only when no field has that name. It does not change existing fields.
- The three PocketBase setup scripts keep credentials and the token in mode 600 temp files and remove them on exit.
- `verify-pb-encryption.sh` points its child setup script at `127.0.0.1:8099`. Its comment says the harness must never touch production. It uses paths relative to the current directory (`docker/...`, `scripts/...`), so it works only from the repo root.
- `verify-pb-encryption.sh` requires `title`, `tags`, `subtasks`, and `time_entries` to start with `enc:v1:` in SQLite.
- `verify-pb-encryption-remote.sh` deletes the temp task before the temp user. Its header says it proves the plaintext round trip only, not ciphertext at rest.
- `run-pocketbase-system-test.sh` pins `CURRENT_POCKETBASE_VERSION` and `UPGRADE_SOURCE_VERSION` and checks each download against a SHA-256 value. Its `cleanup` removes only a path that matches its own temp pattern.
- `tlc.sh` pins `TLA_VERSION=1.7.4` and checks `TLA_SHA256` on every run, including for a cached jar. It runs TLC with `-workers 1`.
- `build-static-export.sh` runs in this order: `next build`, stamp `out/sw.js`, externalize inline blocks. `public/sw.js` keeps its placeholder.
- `update-sw-version.cjs:VERSION_PATTERN` requires a version that starts with a digit. `stampCacheVersion` throws when the placeholder is missing.
- `generate-sw-cache-logic.cjs:generateSwCacheLogic` throws when an `export` line remains after the transform.
- `check-code-shape.cjs:compareCodeShape` allows no file to exceed its baseline `count` or `max`. `validateDebtLedger` fails after the ledger `deadline`. It also fails when `owner` is blank, when a rule has no `maximumRemainingViolations` ceiling, or when a rule's total exceeds its ceiling.
- `check-bundle-budget.cjs:compareBundleBudget` fails a route with no budget entry or with bytes above the recorded value plus `allowanceBytes`.
- `check-audit-results.cjs:BLOCKING_SEVERITIES` blocks `high` and `critical` only. `ACCEPTED_ADVISORIES` holds one dated exception.
- `check-dependency-licenses.cjs:main` writes no SBOM when a violation exists.
- `bun-test-guard.cjs` makes `bun test` exit 1 every time.
- `failing-agent-prs.cjs:isTrustedProvenance` trusts nothing when the bot login is blank.
- `triage-run.sh` exits 0 without discovery unless `GSD_TRIAGE_BOT_LOGIN` is set. An open `triage:paused` issue also stops it. Its header says it never checks out or runs branch code.
- `builder-run.sh` always refuses to run a build.
- `verify-static-export-artifact.py:validated_members` validates every member before any write. The limits are `MAX_ARCHIVE_BYTES`, `MAX_EXPANDED_BYTES`, `MAX_FILE_BYTES`, and `MAX_MEMBERS`. It rejects links, devices, absolute paths, and `..`.
- `test-coverage.sh` runs with thresholds off (`--no-coverage.thresholds`). Its 80% line is a message only.

## Side Effects

### Production and remote changes

- `deploy-prod.sh`: runs `npm run build`, then `exec deploy-app.sh` against the hard-coded production bucket and distribution. Every `deploy-app.sh` effect below applies.
- `deploy-app.sh`: `aws s3 sync out/ $S3_BUCKET/ --delete` runs twice. The first pass uploads non-HTML assets. The second uploads HTML, `sw.js`, `sw-cache-logic.js`, and `theme-init.js`. Both delete remote objects that are absent locally.
- `deploy-app.sh`: `aws s3 cp ... --metadata-directive REPLACE` runs twice. The first uploads the local `out/theme-init.js` again with new metadata, and the script skips it when the build has no such file. The second copies `index.html` onto itself in the bucket to rewrite its metadata.
- `deploy-app.sh`: calls `fix-discovery-content-types.sh "$S3_BUCKET"`.
- `deploy-app.sh`: `aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths '/*'` clears the CDN cache. It appends `invalidation_id` to `$GITHUB_OUTPUT` when set.
- `fix-discovery-content-types.sh:fix_type`: `aws s3 cp <key> <key> --metadata-directive REPLACE` rewrites content type and cache headers for the `.well-known/` files, `index.md`, and `about/index.md`.
- `deploy-cloudfront-function.sh:publish_function`: `aws cloudfront create-function` or `aws cloudfront update-function` for `gsd-url-rewrite` and `gsd-response-headers`, then `aws cloudfront publish-function` moves each to the LIVE stage.
- `deploy-cloudfront-function.sh`: `aws cloudfront update-distribution` replaces `DefaultCacheBehavior.FunctionAssociations` with those two functions. `aws cloudfront create-invalidation --paths '/*'` follows.
- `deploy-cloudfront-response-headers-policy.sh`: `aws cloudfront create-response-headers-policy` or `aws cloudfront update-response-headers-policy` changes the production security headers policy from `cloudfront/response-headers-policy.json`.
- `setup-pocketbase-collections.sh`: `POST $PB_URL/api/collections` creates the `tasks` collection with its rules, fields, and three indexes.
- `setup-pocketbase-feedback-collection.sh`: `POST $PB_URL/api/collections` creates the `feedback` collection, or `PATCH $PB_URL/api/collections/<id>` replaces its fields, indexes, and rules. This first write sends `createRule: null`, so a run against an existing collection turns anonymous feedback off. A failure at any later check leaves it off.
- `setup-pocketbase-feedback-collection.sh`: `PATCH $PB_URL/api/settings` changes server-wide settings. It enables rate limits, sets the `feedback:create` rule, and sets `logs.maxDays`, `logs.logIP`, and `logs.logAuthId`. It keeps `logs.maxDays` at 0 when the server value is 0 and sets it to 1 otherwise. It sets both log flags to false.
- `setup-pocketbase-feedback-collection.sh`: a final `PATCH $PB_URL/api/collections/<id>` sets `createRule` to an empty string. That enables anonymous creates on `feedback`.
- `update-pocketbase-tasks-schema.sh`: `PATCH $PB_URL/api/collections/tasks` appends any missing field among `notification_sent`, `last_notification_at`, `snoozed_until`, `focus_date`, and `focus_rank`. It also overwrites all five API rules.
- `verify-pb-encryption-remote.sh`: `POST $PB_URL/api/collections/users/records` and `POST $PB_URL/api/collections/tasks/records` create a temp user and a temp task. `remove_record` sends `DELETE` for both on exit. A failed delete leaves them on the server and prints a warning.
- `setup-labels.sh:create`: `gh label create <name> --force` runs ten times. It creates or overwrites the `risk:*`, `plan:*`, `agent:building`, `builder:paused`, and `triage:paused` labels on the repo.
- All three PocketBase setup scripts and `verify-pb-encryption-remote.sh` sign in with `POST $PB_URL/api/collections/_superusers/auth-with-password`.

### Network reads and downloads

- `smoke-test.sh`: five `curl` reads against `SITE_URL`. No writes.
- `setup-pocketbase-feedback-collection.sh`: one `GET $PB_URL/api/collections/feedback`, two `GET $PB_URL/api/gsd/feedback-controls`, and two `GET $PB_URL/api/settings`. Each pair reads once before the settings change and once after.
- `triage-run.sh`: `gh issue list` and `gh pr list` reads against `GSD_TRIAGE_REPO`.
- `tlc.sh:ensure_jar`: downloads `tla2tools.jar` from the tlaplus GitHub release with `curl -fsSL` when the cached jar is absent.
- `run-pocketbase-system-test.sh:download_pocketbase`: downloads two PocketBase release archives from GitHub with `curl -fsSL`.

### Local files and processes

- `build-local.sh`: `rm -rf .next-cache .next out` relative to the current directory, then `npm run build`.
- `build-static-export.sh`: runs `next build`, writes `.next/` and `out/`, stamps `out/sw.js`, and rewrites HTML under `out/`.
- `generate-build-info.cjs`: reads `package.json` and the previous `.build-info.json`, then writes `.build-info.json` and `.build-env.sh` in the repo root. A repeat build of the same package version raises the patch number by 1, so the exported build number can differ from `package.json`.
- `update-sw-version.cjs:main`: rewrites the target file in place.
- `externalize-inline-assets.cjs:externalizeInlineAssets`: creates `<out>/_next/static/csp-inline/`, writes hashed `.js` and `.css` files there, and rewrites every `.html` file under the output folder.
- `generate-sw-cache-logic.cjs:main`: writes `public/sw-cache-logic.js` when run directly.
- `check-bundle-budget.cjs:main`: writes `scripts/bundle-budget.json` with `--write-baseline`.
- `check-dependency-licenses.cjs:main`: writes the SBOM file with `--sbom` when no violation exists.
- `check-code-shape.cjs:analyzeCodeShape`: runs ESLint in process over `app/`, `components/`, `lib/`, and `packages/mcp-server/src/`. It writes no files.
- `test-coverage.sh`: runs `bun run test -- --coverage --no-coverage.thresholds`, which writes `coverage/`.
- `tlc.sh`: creates the cache folder (`GSD_TLC_CACHE`), creates a temp `-metadir` and removes it on exit, and starts a Java process.
- `run-pocketbase-system-test.sh`: creates a temp folder, unpacks two binaries there, and runs `bun run --cwd packages/mcp-server test -- src/__tests__/system --no-file-parallelism`. It passes the two binary paths to that run as `POCKETBASE_BIN` and `POCKETBASE_OLD_BIN`.
- `verify-pb-encryption.sh`: creates a temp folder, runs `$PB_BIN migrate up`, and starts `$PB_BIN serve --http=127.0.0.1:8099`. It runs `setup-pocketbase-collections.sh` against that local server and reads `data.db` with `sqlite3`. It stops the server and removes the folder on exit.
- `verify-pb-encryption.sh`: sources `docker/lib/migrations.sh` and builds a fresh migrations folder in the temp folder. It runs `$PB_BIN superuser upsert` on the temp data folder. It generates a key with `openssl rand` and passes it as `GSD_TASKS_ENC_KEY` to `migrate up` and `serve`. It creates one user and one task on the local server.
- `verify-production-csp.cjs` and `verify-production-pwa.cjs`: start a local server from [lib](./lib/README.md) on `127.0.0.1` and launch Playwright browsers.
- `verify-static-export-artifact.py:extract_static_export`: creates `OUTPUT_DIR` and extracts files into it. It removes the folder when a check fails after creation.
- `triage-run.sh:gh_fail_log`: runs `mkdir -p` on `GSD_TRIAGE_LOG_DIR`, then appends to `gh-errors.log` there. The script calls it when a `gh` call fails or the discovery helper does not run. It runs `node $GSD_TRIAGE_HELPER`.
- `triage-run.sh`: appends three directories to `PATH` for its own process: a Homebrew `bin` folder, `$HOME/.local/bin`, and `$HOME/.bun/bin`.
- `deploy-cloudfront-function.sh` and `deploy-cloudfront-response-headers-policy.sh`: create a temp folder for the distribution config and remove it on exit.
- `branch-preflight.sh`: read-only `git` queries.
- `bun-test-guard.cjs`: prints to stderr and calls `process.exit(1)` on load.
- `builder-run.sh`, `check-audit-results.cjs`, `extract-run-tokens.cjs`, `failing-agent-prs.cjs`, `parse-risk-tier.cjs`, `prev-release-tag.cjs`, `telemetry-metrics.cjs`: None beyond stdout and stderr.

## Verification

- Run: `bun run test` (Vitest; never `bun test`). Suites under `tests/` and `tests/data/` cover many of these scripts.
- No automated check found for the deploy scripts. Do not run them to test them.
