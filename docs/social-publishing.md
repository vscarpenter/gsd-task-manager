# Social Publishing (Phase 1 — X / @GSDTaskManager)

Automated, approval-gated X posting for GSD Task Manager releases.

## What it does

When a GitHub **Release** is published, the
[`Post GSD Release to X`](../.github/workflows/post-gsd-release-to-x.yml) workflow:

1. **Composes** a draft post from the release (version, up to 3 highlights, release URL).
2. **Previews** it in the GitHub Actions job summary and uploads it as an artifact.
3. **Publishes** to [@GSDTaskManager](https://x.com/GSDTaskManager) — but only after the
   **`social-gsd-x`** GitHub Environment is approved by a required reviewer.

It also supports manual runs via **workflow_dispatch** for dry-run previews and for
publishing exact, hand-written text. Nothing is ever posted on commits, PRs, or from forks.

The publisher is an isolated npm package at [`tools/social-publisher/`](../tools/social-publisher)
— it is **not** part of the app's bun workspace and shares none of its dependencies.

### How highlights are chosen

The repo's releases use GitHub's auto-generated "What's Changed" PR list. The composer:

- keeps `feat`/`fix`/`perf` PRs, drops `test`/`chore`/`docs`/`ci`/`build`/`refactor`/`style` and `*(deps)`;
- strips the `type(scope):` prefix, the `by @user in <url>` suffix, markdown links, and PR numbers;
- caps at 3 highlights;
- for hand-written `### Added`/`### Fixed` release notes, uses those section bullets instead;
- falls back to the release title's subtitle (`v10.0.0 — Security & Sync` → "This release focuses on Security & Sync."), then to a generic line.

Because PR order is not importance order, **always review the draft in the job summary**
before approving. For any release where the auto-text is weak, re-run via
workflow_dispatch with exact `post_text`.

## One-time setup

### 1. X developer app

1. Create (or confirm) an X developer app for `@GSDTaskManager`.
2. Ensure the app has **Read and Write** permissions.
3. Generate **user-context** OAuth 1.0a tokens for the account:
   `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.

### 2. GitHub Environment `social-gsd-x`

Create the environment so publishing is gated behind human approval:

1. Repo → **Settings → Environments → New environment** → name it `social-gsd-x`.
2. Under **Deployment protection rules**, enable **Required reviewers** and add yourself.
3. Under **Environment secrets** (NOT repository secrets), add the four secrets:

   ```
   X_API_KEY
   X_API_SECRET
   X_ACCESS_TOKEN
   X_ACCESS_TOKEN_SECRET
   ```

Storing them as environment secrets means the publish job can only read them after the
environment is approved. The compose job never sees them.

## Running it

### Dry run (no credentials needed)

Actions → **Post GSD Release to X** → **Run workflow** → `dry_run: true`. The `compose`
job builds and previews a post in the summary; the `publish` job is skipped, so no
credentials or approval are involved.

To preview exact text, also fill `post_text` (and optionally `release_url`).

### Manual publish

Run the workflow with `dry_run: false` **and** a non-empty `post_text`. The `publish` job
then waits for `social-gsd-x` approval. (A `dry_run: false` run with no `post_text` only
produces a sample and will **not** publish.)

### Publish from a GitHub Release

Publish a Release as usual. The workflow composes the post and the `publish` job pauses
for `social-gsd-x` approval. Review the draft in the run summary, then approve to post.
The summary then shows the resulting post URL.

## Operations

### Rotate X credentials

1. In the X developer portal, regenerate the access token/secret (and API key/secret if needed).
2. Update the four secrets under **Settings → Environments → `social-gsd-x`**.
3. Revoke the old tokens in the X portal.

No code change or redeploy is required.

### Disable quickly

Any one of these stops all posting immediately:

- Actions → **Post GSD Release to X** → **⋯ → Disable workflow**.
- Remove the required-reviewer approval (or yourself as reviewer) on `social-gsd-x` — approvals can no longer be granted.
- Delete the four environment secrets — the publish job fails closed (`Missing required secrets`) without posting.

## Quality bar

```bash
cd tools/social-publisher
npm ci
npm test
```

## Setup Checklist

- [ ] Create or confirm the X developer app.
- [ ] Ensure the X app has write permissions.
- [ ] Generate user-context tokens for `@GSDTaskManager`.
- [ ] Create GitHub Environment `social-gsd-x`.
- [ ] Add required reviewers to `social-gsd-x`.
- [ ] Add X secrets to `social-gsd-x`.
- [ ] Run the workflow manually with `dry_run=true`.
- [ ] Confirm the preview post looks right.
- [ ] Run the workflow manually with `dry_run=false` and `post_text`.
- [ ] Confirm the post appears on `@GSDTaskManager`.
- [ ] Publish the next GitHub Release and confirm the release workflow works.

## Sample release note → expected post

Release body:

```markdown
## What's Changed

### Added
- Added faster quick capture from the menu bar.
- Added better grouping for completed tasks.

### Fixed
- Fixed a bug where completed tasks could briefly reappear after sync.
```

Composed post:

```text
GSD Task Manager v1.2.3 is out.

New in this release:
• Added faster quick capture from the menu bar
• Added better grouping for completed tasks
• Fixed a bug where completed tasks could briefly reappear after sync

Release notes:
https://github.com/vscarpenter/gsd-task-manager/releases/tag/v1.2.3
```

## Security

- Credentials live only in the `social-gsd-x` environment; the compose job runs without them.
- Secrets are never logged; the publisher prints only the SDK message/code on failure.
- The dry-run path never imports the X SDK and never calls the API.
- Workflow permissions are `contents: read`; no forks, no PRs, one publish per run.
