# Codex Implementation Spec: Phase 1 X Posting Automation for GSD Task Manager

## Objective

Add a Phase 1 automated social publishing workflow to the `gsd-taskmanager` project.

The workflow should create a draft X post when a GitHub Release is published, show the proposed post in the GitHub Actions summary, require approval through a GitHub Environment, and then publish the post to the `@GSDTaskManager` X account using the official X API.

This first phase should be safe, deterministic, and easy to review. Do not build a general marketing platform yet. This is the small, sharp version.

## Target App

App name: `GSD Task Manager`

X account: `@GSDTaskManager`

Default tone:

- Direct
- Practical
- Human
- Lightly opinionated
- No hype
- No growth-hack language
- No generic “big news” launch-post energy

Preferred style:

- “Here is what improved.”
- “Here is why it helps.”
- “Here is where to read more.”

Avoid:

- Excess hashtags
- Emojis by default
- Identical repost-style language
- Posting for internal refactors unless they are user-visible
- Anything that sounds like a bot discovered venture capital

## Phase 1 Scope

Build support for these triggers:

1. `release.published`
   - When a GitHub Release is published, compose a post from the release metadata.
   - The post should include the release version, 1 to 3 short highlights, and the release URL.

2. `workflow_dispatch`
   - Allow manual dry-run testing.
   - Allow manual publishing with explicitly supplied post text.
   - Manual publishing must still use the protected GitHub Environment.

Do not post on every commit.
Do not post on every merged PR.
Do not implement cross-repo support yet.
Do not implement weekly digests yet.
Do not use AI-generated copy in Phase 1.

## Required Deliverables

Add these files, adjusting paths only if the repo has a strong existing convention:

```text
.github/workflows/post-gsd-release-to-x.yml
tools/social-publisher/package.json
tools/social-publisher/package-lock.json
tools/social-publisher/src/compose-post.mjs
tools/social-publisher/src/post-to-x.mjs
tools/social-publisher/src/post-utils.mjs
tools/social-publisher/test/post-utils.test.mjs
docs/social-publishing.md
```

If the repository already has a Node toolchain and a clear scripts/tools convention, integrate with the existing convention instead of creating a conflicting one. Keep this isolated from production app dependencies.

## External API Requirements

Use the official X API endpoint:

```text
POST https://api.x.com/2/tweets
```

The request body should be:

```json
{
  "text": "post text here"
}
```

Use user-context credentials for the `@GSDTaskManager` account.

Preferred implementation:

- Use Node.js 24.
- Use the `twitter-api-v2` npm package, pinned in `package-lock.json`.
- Authenticate with OAuth 1.0a credentials because they are practical for server-side automation in GitHub Actions.

Required environment secrets:

```text
X_API_KEY
X_API_SECRET
X_ACCESS_TOKEN
X_ACCESS_TOKEN_SECRET
```

Optional environment variables:

```text
X_ACCOUNT_HANDLE=GSDTaskManager
APP_NAME=GSD Task Manager
MAX_POST_CHARS=280
DRY_RUN=true|false
```

Do not log secrets.
Do not print token prefixes.
Do not write credentials to disk.
Do not add real credentials to test fixtures.

## GitHub Environment Requirement

The publish job must use this GitHub Environment:

```text
social-gsd-x
```

The docs should instruct the repo owner to create this environment manually in GitHub with required reviewer protection enabled.

Environment secrets should be stored under `social-gsd-x`, not as broad repository secrets.

Required environment secrets:

```text
X_API_KEY
X_API_SECRET
X_ACCESS_TOKEN
X_ACCESS_TOKEN_SECRET
```

The workflow should not be able to publish until the `social-gsd-x` environment is approved.

## Workflow Behavior

Create `.github/workflows/post-gsd-release-to-x.yml`.

The workflow should support:

```yaml
on:
  release:
    types: [published]

  workflow_dispatch:
    inputs:
      dry_run:
        description: "Compose and preview only; do not publish"
        required: true
        default: "true"
        type: choice
        options:
          - "true"
          - "false"

      post_text:
        description: "Optional exact post text. If supplied, use this instead of generated release text."
        required: false
        type: string

      release_url:
        description: "Optional release URL to include when using manual post text."
        required: false
        type: string
```

Jobs:

### Job 1: compose

Purpose:

- Compose the proposed post.
- Validate length.
- Print the preview to the GitHub Actions job summary.
- Save the proposed post as an artifact.
- Expose the composed post as a job output.

Behavior:

- For `release.published`, read release data from the GitHub event payload.
- For `workflow_dispatch`, use `inputs.post_text` if supplied.
- If no manual text is supplied during `workflow_dispatch`, create a harmless sample/dry-run post and do not publish.
- Fail clearly if the post is empty.
- Fail clearly if the post exceeds `MAX_POST_CHARS`.
- Do not call X from this job.

Suggested summary format:

````markdown
## Draft X Post for @GSDTaskManager

```text
GSD Task Manager v1.2.3 is out.

New in this release:
• Faster quick capture
• Cleaner task review
• Better handling for completed work

Release notes:
https://github.com/OWNER/REPO/releases/tag/v1.2.3
```

Length: 239 / 280 characters
Dry run: true
````

### Job 2: publish

Purpose:

- Publish the already-composed post to X.
- Only run when publishing is explicitly allowed.
- Require the `social-gsd-x` GitHub Environment.
- Print the resulting X post ID and URL to the GitHub Actions summary.

Rules:

- For `release.published`, default to publishing after environment approval.
- For `workflow_dispatch`, only publish when `dry_run` is `"false"`.
- Never publish if the composed post is empty.
- Never publish if required secrets are missing.
- Never publish on pull requests.
- Never publish from forks.
- Never publish more than once in a single workflow run.

Suggested condition:

```yaml
if: >
  github.event_name == 'release' ||
  (github.event_name == 'workflow_dispatch' && inputs.dry_run == 'false')
```

Use minimal permissions:

```yaml
permissions:
  contents: read
```

## Post Composition Requirements

Implement `tools/social-publisher/src/compose-post.mjs`.

It should:

1. Read the GitHub event JSON from `GITHUB_EVENT_PATH`.
2. Detect whether the event is `release` or `workflow_dispatch`.
3. Compose deterministic post text.
4. Write the final post to stdout or a specified output file.
5. Print a clean error and exit non-zero on invalid input.

For release posts, use this structure:

```text
GSD Task Manager {version} is out.

New in this release:
• {highlight 1}
• {highlight 2}
• {highlight 3}

Release notes:
{release_url}
```

If there are no usable release highlights, use:

```text
GSD Task Manager {version} is out.

This release includes small improvements and fixes to make the task flow smoother.

Release notes:
{release_url}
```

Highlight extraction rules:

- Prefer bullets from release body sections named:
  - `Added`
  - `Changed`
  - `Improved`
  - `Fixed`
  - `What Changed`
  - `Changes`
- Use at most 3 bullets.
- Strip Markdown links down to readable text when needed.
- Remove issue numbers if they make the post noisy.
- Keep each highlight short.
- Ignore dependency-only changes unless the release has no other content.
- Ignore internal-only refactors unless the release has no other content.

If the composed post exceeds the max length:

- Try again with fewer bullets.
- Try again with shorter phrasing.
- If still too long, fail and ask for a manual override.
- Do not silently publish a mangled post.

Manual override rules:

- If `post_text` is supplied, use it exactly after trimming surrounding whitespace.
- If `release_url` is supplied and the manual post does not already include it, append it only if length allows.
- If length exceeds max, fail.

## Publishing Requirements

Implement `tools/social-publisher/src/post-to-x.mjs`.

It should:

1. Read post text from:
   - `POST_TEXT`, or
   - a file path argument such as `--post-file`.
2. Validate required secrets:
   - `X_API_KEY`
   - `X_API_SECRET`
   - `X_ACCESS_TOKEN`
   - `X_ACCESS_TOKEN_SECRET`
3. Validate non-empty post text.
4. Validate max length.
5. If `DRY_RUN=true`, do not call X. Print a dry-run message and exit 0.
6. If `DRY_RUN=false`, publish to X.
7. On success, print structured JSON:

```json
{
  "ok": true,
  "post_id": "1234567890",
  "post_url": "https://x.com/GSDTaskManager/status/1234567890"
}
```

8. On failure, print a useful error message without exposing secrets.

Do not retry blindly forever.
A single short retry for transient 429 or 5xx responses is acceptable, but keep it conservative.

## Utility Functions

Implement reusable utilities in `post-utils.mjs`.

Required exported functions:

```js
extractHighlights(releaseBody: string): string[]
composeReleasePost({
  appName,
  version,
  releaseName,
  releaseBody,
  releaseUrl,
  maxChars
}): string
validatePostText(text: string, maxChars: number): void
normalizeHighlight(text: string): string
```

Keep functions pure where practical so they are easy to test.

## Tests

Use Node’s built-in test runner unless the repo already has a preferred test framework.

Add tests for:

1. Extracts bullets from `Added`, `Changed`, `Fixed`, and `What Changed`.
2. Ignores empty release bodies.
3. Removes noisy Markdown syntax.
4. Limits highlights to 3.
5. Composes fallback post when no highlights exist.
6. Fails validation for empty post text.
7. Fails validation for over-length post text.
8. Manual override path preserves the supplied text.
9. Long release notes are shortened rather than blindly accepted.
10. Dependency-only changes are deprioritized when user-facing changes exist.

Add package scripts:

```json
{
  "scripts": {
    "test": "node --test",
    "compose:dry-run": "node src/compose-post.mjs"
  }
}
```

## Documentation

Create `docs/social-publishing.md`.

It should explain:

1. What the workflow does.
2. How to create the `social-gsd-x` GitHub Environment.
3. Which secrets to add.
4. How to run a dry run.
5. How to manually publish a post.
6. How to publish from a GitHub Release.
7. How to rotate X credentials.
8. How to disable the workflow quickly if something goes wrong.

Include this operational checklist:

```markdown
## Setup Checklist

- [ ] Create or confirm the X developer app.
- [ ] Ensure the X app has write permissions.
- [ ] Generate user-context tokens for `@GSDTaskManager`.
- [ ] Create GitHub Environment `social-gsd-x`.
- [ ] Add required reviewers to `social-gsd-x`.
- [ ] Add X secrets to `social-gsd-x`.
- [ ] Run the workflow manually with `dry_run=true`.
- [ ] Confirm the preview post looks right.
- [ ] Run the workflow manually with `dry_run=false`.
- [ ] Confirm the post appears on `@GSDTaskManager`.
- [ ] Publish the next GitHub Release and confirm the release workflow works.
```

Also include a sample release note that produces a good post:

```markdown
## What's Changed

### Added
- Added faster quick capture from the menu bar.
- Added better grouping for completed tasks.

### Fixed
- Fixed a bug where completed tasks could briefly reappear after sync.
```

Expected post:

```text
GSD Task Manager v1.2.3 is out.

New in this release:
• Added faster quick capture from the menu bar
• Added better grouping for completed tasks
• Fixed a bug where completed tasks could briefly reappear after sync

Release notes:
{release_url}
```

## Security Requirements

- Never commit credentials.
- Never log credentials.
- Never use browser automation or cookie-based posting.
- Never store the X password.
- Never store generated posts in a public issue unless that is intentional.
- Keep publishing behind the GitHub Environment approval gate.
- Keep GitHub Actions permissions minimal.
- The dry-run path must not call the X API.

## Quality Bar

Before finishing, run:

```bash
cd tools/social-publisher
npm ci
npm test
```

Also validate the GitHub Actions YAML syntax.

If the repository already uses a linter or formatter, apply it only to the files added or changed for this feature.

## Acceptance Criteria

The work is complete when:

1. A GitHub Release can trigger a workflow that composes a GSD X post.
2. The composed post appears in the GitHub Actions summary before publishing.
3. A manual dry run can be executed without X credentials.
4. Publishing requires the `social-gsd-x` GitHub Environment.
5. Publishing uses the `@GSDTaskManager` user-context credentials.
6. The workflow publishes to X only after environment approval.
7. The workflow prints the resulting X post URL on success.
8. Tests cover post composition and validation.
9. Documentation explains setup, dry-run, manual publishing, and release publishing.
10. No secrets are committed, logged, or exposed.

## Suggested Implementation Order

1. Add isolated `tools/social-publisher` package.
2. Implement post utility functions and tests.
3. Implement `compose-post.mjs`.
4. Implement `post-to-x.mjs`.
5. Add the GitHub Actions workflow.
6. Add documentation.
7. Run tests.
8. Run a manual dry run.
9. Prepare a short PR summary with setup steps that must be completed in GitHub.

## PR Summary Template

Use this in the final PR description:

```markdown
## Summary

Adds Phase 1 social publishing automation for GSD Task Manager.

This workflow composes an X post from GitHub Release metadata, previews it in the GitHub Actions summary, and publishes to `@GSDTaskManager` only after approval through the `social-gsd-x` GitHub Environment.

## Added

- Release-triggered GitHub Actions workflow
- Manual dry-run and manual publish support
- Isolated social publisher Node utility
- Post composition and validation tests
- Setup and operations documentation

## Required Manual Setup

Before publishing works, create the `social-gsd-x` GitHub Environment and add these secrets:

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`

Enable required reviewer approval on the environment.

## Validation

- `npm ci`
- `npm test`
- Manual dry-run workflow
```
