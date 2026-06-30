# Social Publishing Phase 1 (X) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a GitHub Release is published, compose a draft X post from the release, preview it in the Actions summary, and publish to `@GSDTaskManager` only after approval through the `social-gsd-x` GitHub Environment.

**Architecture:** An isolated npm package at `tools/social-publisher/` (outside the `packages/*` bun workspace) holds three small ESM CLIs over a pure-function core (`post-utils.mjs`). A two-job workflow composes (no secrets) then publishes (environment-gated). `twitter-api-v2` is lazy-imported only on the real publish path so unit tests and dry-runs need no network or SDK.

**Tech Stack:** Node 24 (CI) / 22 (local), npm + `package-lock.json`, `node --test`, `twitter-api-v2` (OAuth 1.0a user-context), GitHub Actions.

## Global Constraints

- App name: `GSD Task Manager`; X handle: `GSDTaskManager`; endpoint `POST https://api.x.com/2/tweets` body `{"text": "..."}`.
- `MAX_POST_CHARS` default `280`. Tone: direct, practical, no hype, no emojis-by-default, no excess hashtags.
- Required secrets (env-scoped to `social-gsd-x`): `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.
- Optional env: `X_ACCOUNT_HANDLE=GSDTaskManager`, `APP_NAME=GSD Task Manager`, `MAX_POST_CHARS=280`, `DRY_RUN=true|false`.
- NEVER log/print secrets or token prefixes; never write credentials to disk; never put real creds in fixtures.
- Dry-run path must NOT call the X API. Publish only behind the `social-gsd-x` environment. Workflow permissions: `contents: read`. Never publish from forks; never publish twice per run.
- Isolated from the app: `tools/social-publisher` is NOT a `packages/*` workspace member; bun/vitest/main-CI never touch it.
- Highlight sourcing (decided): filter GitHub "What's Changed" PR lists to `feat`/`fix`/`perf`, drop `test`/`chore`/`docs`/`ci`/`build`/`refactor`/`style`/`*(deps)`; fall back to the release-title subtitle, then a generic line.

---

## File Structure

| File | Responsibility |
|---|---|
| `tools/social-publisher/package.json` | npm package metadata, scripts, `twitter-api-v2` dep |
| `tools/social-publisher/package-lock.json` | pinned lockfile for `npm ci` |
| `tools/social-publisher/src/post-utils.mjs` | pure functions: extract/normalize highlights, compose, validate |
| `tools/social-publisher/src/compose-post.mjs` | CLI: GitHub event JSON / dispatch inputs → post text → file + stdout + summary |
| `tools/social-publisher/src/post-to-x.mjs` | CLI: post text → X API (lazy `twitter-api-v2`), dry-run aware |
| `tools/social-publisher/test/post-utils.test.mjs` | `node --test` unit tests (pure, no deps) |
| `.github/workflows/post-gsd-release-to-x.yml` | compose + publish jobs, env gate, triggers |
| `docs/social-publishing.md` | setup, environment, secrets, dry-run, publish, rotate, disable |

### Public interfaces (`post-utils.mjs`)

```js
// Strip conventional-commit prefix (`type(scope): `), GitHub "by @user in <url>"
// suffix, trailing "(#123)"/"#123", markdown links ([t](u) -> t); collapse
// whitespace; trim; capitalize first letter. Returns "" if nothing remains.
normalizeHighlight(text: string): string

// Parse release body. Returns up to 3 USER-FACING highlights only.
// Keeps feat/fix/perf and prefix-less human bullets; drops test/chore/docs/ci/
// build/refactor/style and *(deps). Handles both Keep-a-Changelog sections and
// GitHub auto "## What's Changed" PR lists. Empty array when nothing user-facing.
extractHighlights(releaseBody: string): string[]

// Return curated subtitle from a release title like "v10.0.0 — Foo & Bar"
// (text after an em-dash or " - " separator), else null.
parseReleaseSubtitle(releaseName: string): string | null

// Build the final post. Body precedence: user-facing highlights -> subtitle
// summary -> generic line. Shrinks (drop bullets) to fit maxChars; throws if
// still over after dropping all bullets.
composeReleasePost({ appName, version, releaseName, releaseBody, releaseUrl, maxChars }): string

// Throw on empty/whitespace text or text.length > maxChars. Returns void.
validatePostText(text: string, maxChars: number): void
```

---

## Task 1: Scaffold the isolated package

**Files:** Create `tools/social-publisher/package.json`, `.gitignore`; generate `package-lock.json`.

- [ ] **Step 1:** Write `package.json`:

```json
{
  "name": "gsd-social-publisher",
  "version": "0.1.0",
  "private": true,
  "description": "Phase 1 X publishing for GSD Task Manager (isolated, not a workspace member).",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test",
    "compose:dry-run": "node src/compose-post.mjs"
  },
  "dependencies": { "twitter-api-v2": "1.27.0" }
}
```

- [ ] **Step 2:** Write `tools/social-publisher/.gitignore` with `node_modules/`.
- [ ] **Step 3:** Generate the lockfile. Try in place first: `cd tools/social-publisher && npm install --package-lock-only`. If it errors with `EOVERRIDE` (root overrides bleed in — the Remotion precedent), generate in the scratchpad and copy `package-lock.json` back: run `npm install --package-lock-only` in a temp copy of the package.json outside the repo, then move the lockfile in.
- [ ] **Step 4:** Commit: `git add tools/social-publisher/package.json tools/social-publisher/package-lock.json tools/social-publisher/.gitignore && git commit -m "build(social): scaffold isolated social-publisher package"`

## Task 2: `post-utils.mjs` — pure core (TDD)

**Files:** Create `tools/social-publisher/src/post-utils.mjs`; Test `tools/social-publisher/test/post-utils.test.mjs`.

**Test list (the 10 spec cases + 2 for the real format):**
1. extracts feat/fix bullets from a "What's Changed" PR list
2. extracts bullets from hand-written `### Added`/`### Fixed` sections
3. drops `test`/`chore`/`docs`/`ci`/`refactor` PRs (real-format noise filter)
4. ignores empty/whitespace release bodies → `[]`
5. `normalizeHighlight` strips `type(scope):`, `by @user in <url>`, `(#123)`, markdown links
6. limits highlights to 3
7. `composeReleasePost` uses generic fallback when no highlights and no subtitle
8. `composeReleasePost` uses subtitle fallback when no user-facing highlights but title has subtitle
9. `validatePostText` throws on empty text
10. `validatePostText` throws on over-length text
11. long release notes shrink (drop bullets) rather than blindly exceeding maxChars
12. dependency-only PRs deprioritized when user-facing changes exist

- [ ] **Step 1:** Write all tests above (real assertions, fixtures inline). Use a v10.0.0-style "What's Changed" fixture.
- [ ] **Step 2:** Run `cd tools/social-publisher && node --test` → expect FAIL (module missing).
- [ ] **Step 3:** Implement `post-utils.mjs` with the five exported functions per the interface block. Constants: `USER_FACING_TYPES = new Set(['feat','fix','perf'])`, `KAC_HEADINGS = /added|changed|improved|fixed|what changed|changes/i`.
- [ ] **Step 4:** Run `node --test` → expect PASS.
- [ ] **Step 5:** Commit: `feat(social): post composition + validation utilities with tests`

## Task 3: `compose-post.mjs` — event → post CLI

**Files:** Create `tools/social-publisher/src/compose-post.mjs`. (Covered by Task 2 utils + a smoke run.)

Behavior:
- Read `GITHUB_EVENT_NAME`, `GITHUB_EVENT_PATH` (JSON), `APP_NAME`, `MAX_POST_CHARS`, `X_ACCOUNT_HANDLE`.
- `release`: `composeReleasePost({appName, version: release.tag_name, releaseName: release.name, releaseBody: release.body, releaseUrl: release.html_url, maxChars})`.
- `workflow_dispatch`: if `inputs.post_text` non-empty → trim, optionally append `inputs.release_url` if absent and length allows, `validatePostText`. If no `post_text` → emit a harmless sample post and mark dry-run (publish job will be skipped anyway).
- Output: write post to `--out <file>` (and echo to stdout). Append a markdown preview block + `Length: N / MAX` + `Dry run: <bool>` to `$GITHUB_STEP_SUMMARY` when set.
- Empty/over-length → print a clean error, exit non-zero (no mangled publish).

- [ ] **Step 1:** Implement `compose-post.mjs`.
- [ ] **Step 2:** Smoke test with a fixture event file: `GITHUB_EVENT_NAME=release GITHUB_EVENT_PATH=/tmp/ev.json node src/compose-post.mjs --out /tmp/post.txt` → prints the v10.0.0 post; exit 0.
- [ ] **Step 3:** Commit: `feat(social): compose-post CLI for release and manual events`

## Task 4: `post-to-x.mjs` — publish CLI (lazy SDK)

**Files:** Create `tools/social-publisher/src/post-to-x.mjs`.

Behavior:
- Post text from `POST_TEXT` env or `--post-file <path>`.
- Require all four `X_*` secrets present (presence only; never print values). Missing → error, exit non-zero.
- `validatePostText(text, MAX_POST_CHARS)`.
- `DRY_RUN=true` → print `{"ok":true,"dry_run":true}` and exit 0 WITHOUT importing/calling the SDK.
- `DRY_RUN=false` → `const { TwitterApi } = await import('twitter-api-v2')`; OAuth1.0a client; `client.v2.tweet(text)`; one short retry on 429/5xx (single, bounded). Success → print `{"ok":true,"post_id","post_url":"https://x.com/<handle>/status/<id>"}`. Failure → useful error w/o secrets, exit non-zero.

- [ ] **Step 1:** Implement `post-to-x.mjs`.
- [ ] **Step 2:** Dry-run smoke (no creds, no network): `DRY_RUN=true POST_TEXT="hello" X_API_KEY=x X_API_SECRET=x X_ACCESS_TOKEN=x X_ACCESS_TOKEN_SECRET=x node src/post-to-x.mjs` → prints dry-run JSON, exit 0, never imports SDK.
- [ ] **Step 3:** Missing-secret smoke: unset one `X_*`, `DRY_RUN=false` → clean error, exit non-zero, no secret echoed.
- [ ] **Step 4:** Commit: `feat(social): post-to-x publisher with dry-run and lazy SDK import`

## Task 5: GitHub Actions workflow

**Files:** Create `.github/workflows/post-gsd-release-to-x.yml`.

- `on`: `release: [published]`; `workflow_dispatch` with inputs `dry_run` (choice true/false, default true), `post_text` (string, optional), `release_url` (string, optional).
- `permissions: contents: read`.
- Job `compose`: runs on the main repo only (`if: github.repository == 'vscarpenter/gsd-task-manager'`); checkout; `actions/setup-node@v4` node 24; `cd tools/social-publisher && npm ci`; run compose-post writing `post.txt`; `actions/upload-artifact` the post; outputs `length`. No secrets.
- Job `publish`: `needs: compose`; `if: github.event_name == 'release' || (github.event_name == 'workflow_dispatch' && inputs.dry_run == 'false')`; `environment: social-gsd-x`; download artifact; `npm ci`; `DRY_RUN=false node src/post-to-x.mjs --post-file post.txt` with the four `X_*` env from `secrets`; print result to `$GITHUB_STEP_SUMMARY`.

- [ ] **Step 1:** Write the workflow.
- [ ] **Step 2:** Validate YAML parses (ruby `YAML.load_file`) and `if`/inputs intact.
- [ ] **Step 3:** Commit: `ci(social): release-triggered X publish workflow with environment gate`

## Task 6: Documentation

**Files:** Create `docs/social-publishing.md`.

Cover: what it does; create `social-gsd-x` Environment with required reviewers; add the four env secrets; run a dry-run dispatch; manual publish; release publish; rotate X credentials; disable quickly (delete/disable workflow or remove env approval); the Setup Checklist; the sample release note + expected post.

- [ ] **Step 1:** Write `docs/social-publishing.md`.
- [ ] **Step 2:** Commit: `docs(social): setup and operations guide for X publishing`

## Task 7: Verify & PR

- [ ] **Step 1:** `cd tools/social-publisher && npm ci && npm test` → all green.
- [ ] **Step 2:** Re-validate workflow YAML.
- [ ] **Step 3:** Move the original root spec into `docs/` (or leave); decide with repo owner.
- [ ] **Step 4:** Push branch; open PR using the spec's PR Summary Template (with the Required Manual Setup section).

---

## Risks / Notes
- **Lockfile isolation:** if `npm install` under the repo hits `EOVERRIDE` from root `overrides`, generate the lockfile outside the repo and copy it in; in CI, `npm ci` runs with `working-directory: tools/social-publisher` and the committed lockfile — confirm it resolves without the root overrides (add `--no-workspaces` if needed).
- **Manual prerequisites (owner):** X developer app with write perms, user-context tokens for `@GSDTaskManager`, the `social-gsd-x` Environment + reviewers + secrets. Nothing posts until these exist and an approval is granted.
- **Node 24** in CI per spec; local dev on 22 is fine (`node --test`, no SDK needed for tests).
