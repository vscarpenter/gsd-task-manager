# GitHub Repository Settings Checklist

Complete these settings on GitHub to secure your repository for public contributions.

## Step 1: The `main-protection` ruleset

Navigate to: **Settings → Rules → Rulesets → main-protection** (target: the default branch).

`main` is protected by a ruleset, not classic branch protection, so
`gh api repos/{owner}/{repo}/branches/main/protection` returns 404. Read the
live rules with `gh api repos/{owner}/{repo}/rulesets/8643215`.

- [x] **Require a pull request before merging**
  - Required approvals: **0**. The sole owner can't approve their own PRs, so the
    required checks are the gate.
  - [ ] Require review from Code Owners: **off**. It can never be satisfied on the
    owner's own PRs, and when it was on it forced a bypass on every merge, which
    also skipped the required checks.
  - [x] Dismiss stale approvals when new commits are pushed
  - [x] Require conversation resolution before merging. Resolve review-bot threads
    before merging; nothing bypasses this.

- [x] **Require status checks to pass**
  - Branches don't need to be up to date before merging.
  - Required checks:
    - `lint`, `typecheck`, `test`, `build` (`.github/workflows/ci.yml`)
    - `audit` (`.github/workflows/security-audit.yml`)
    - `e2e (chromium)`, `e2e (firefox)`, `e2e (webkit)` (`.github/workflows/ci.yml`)
    - `pr-shape` (`.github/workflows/pr-shape.yml`). A PR over 15 counted files
      needs the `large-pr` label, and a version bump needs a `chore(release)` title.
  - A check must have run at least once before the ruleset can require it.

- [x] **Require linear history**
- [x] **Block force pushes**
- [x] **Restrict deletions**

- [x] **No bypass list.** Leave "Bypass list" empty. Every merge, the owner's
  included, waits for every required check. In an emergency, edit the ruleset
  on purpose; don't merge around it.

## Step 2: General Repository Settings

Navigate to: **Settings → General**

### Features
- [x] **Wikis**: Uncheck (unless you plan to use)
- [x] **Issues**: Keep checked
- [x] **Sponsorships**: Optional
- [x] **Projects**: Optional
- [x] **Discussions**: Optional (good for Q&A)

### Pull Requests
- [x] **Allow merge commits**: Check
- [x] **Allow squash merging**: Check (recommended)
- [x] **Allow rebase merging**: Check
- [x] **Always suggest updating pull request branches**: Check
- [x] **Allow auto-merge**: Check
- [x] **Automatically delete head branches**: Check ✅ (recommended)

### Archives
- [x] **Include Git LFS objects in archives**: Leave unchecked (not used)

## Step 3: Code Security and Analysis

Navigate to: **Settings → Code security and analysis**

- [x] **Dependency graph**: Enable
- [x] **Dependabot alerts**: Enable
- [x] **Dependabot security updates**: Enable
- [x] **Grouped security updates**: Enable
- [x] **Secret scanning**: Enable (if available)
- [x] **Push protection**: Enable (if available)

## Step 4: Release Environments and Tag Rules

Navigate to: **Settings → Environments**

Create or verify these environments:

- [x] `production`
  - [x] Required reviewers: `vscarpenter`
  - [x] Deployment branches and tags: protected branches and protected tags only

- [x] `mcp-release`
  - [x] Required reviewers: `vscarpenter`
  - [x] Deployment branches and tags: protected branches and protected tags only

Navigate to: **Settings → Rules → Rulesets**

Create release tag rulesets:

- [x] `v*.*.*` app release tags
- [x] `mcp-v*.*.*` MCP package release tags
- [x] Require creation/update through reviewed `main` release flow
- [x] Block force-pushes and deletions

The workflows also verify that release commits are reachable from `origin/main`.
The environment rules provide the human approval boundary before production
deploys or package publishes can use protected credentials.

## Step 5: Moderation Settings

Navigate to: **Settings → Moderation options**

### Interaction limits
- Set to **Limit to existing users** for first 30 days if you want to prevent spam
- Or leave at **No restrictions** if you want open contributions immediately

### Code review limits
- Leave at default (allow anyone)

## Step 6: Make Repository Public

Navigate to: **Settings → General → Danger Zone**

1. Scroll to bottom
2. Click **Change repository visibility**
3. Select **Make public**
4. Type repository name to confirm: `gsd-task-manager`
5. Click **I understand, change repository visibility**

## Step 7: Add Repository Topics (Optional)

At the top of your repository page:

Click **⚙️ Settings (gear icon)** next to About

Add topics:
- `task-manager`
- `eisenhower-matrix`
- `pwa`
- `nextjs`
- `typescript`
- `privacy-first`
- `indexeddb`
- `productivity`

## Step 8: Update Repository Description

In the same About section:

**Description**:
```
Privacy-first task manager using the Eisenhower Matrix. Built with Next.js, TypeScript, and IndexedDB. Works completely offline as a PWA.
```

**Website**: `https://gsd.vinny.dev`

Check:
- [ ] **Use your GitHub Pages website** — disabled; the production website is hosted separately
- [x] **Releases**
- [x] **Packages**

## Verification Checklist

After completing the above:

- [ ] Try creating a test branch and PR to verify protection rules work
- [ ] Verify CODEOWNERS auto-assigns you as reviewer
- [ ] Check that direct pushes to `main` are blocked
- [ ] Verify the repository appears correctly in search with topics
- [ ] Test that Dependabot creates alerts for any outdated dependencies

## Next Steps (Optional)

1. **Set up GitHub Actions CI** - See `.github/workflows/` for CI/CD automation
2. **Add issue templates** - Create bug report and feature request templates
3. **Add PR template** - Guide contributors on what to include in PRs
4. **Set up semantic-release** - Automate versioning and changelog generation
5. **Add badges to README** - Build status, coverage, license, etc.

---

**Note**: Some features like secret scanning may only be available for public repositories or with GitHub Advanced Security.
