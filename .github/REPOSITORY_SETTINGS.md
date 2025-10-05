# GitHub Repository Settings Checklist

Complete these settings on GitHub to secure your repository for public contributions.

## Step 1: Branch Protection Rules

Navigate to: **Settings → Branches → Add branch protection rule**

### Branch name pattern: `main`

Check these options:

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners
  - [x] Require approval of the most recent reviewable push

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - After setting up GitHub Actions CI, add these required checks:
    - `typecheck`
    - `lint`
    - `test`
    - `build`

- [x] **Require conversation resolution before merging**

- [x] **Require linear history** (optional but recommended for clean git history)

- [x] **Do not allow bypassing the above settings**
  - Leave "Allow specified actors to bypass" unchecked

- [x] **Restrict who can push to matching branches**
  - Add yourself as the only allowed pusher
  - Or leave empty to allow only PR merges

- [x] **Require deployments to succeed before merging** (skip for now)

- [x] **Lock branch** (leave unchecked - allows PRs)

- [x] **Do not allow force pushes**

- [x] **Allow deletions** (leave unchecked)

Click **Create** or **Save changes**

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

## Step 4: Moderation Settings

Navigate to: **Settings → Moderation options**

### Interaction limits
- Set to **Limit to existing users** for first 30 days if you want to prevent spam
- Or leave at **No restrictions** if you want open contributions immediately

### Code review limits
- Leave at default (allow anyone)

## Step 5: Make Repository Public

Navigate to: **Settings → General → Danger Zone**

1. Scroll to bottom
2. Click **Change repository visibility**
3. Select **Make public**
4. Type repository name to confirm: `gsd-task-manager`
5. Click **I understand, change repository visibility**

## Step 6: Add Repository Topics (Optional)

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

## Step 7: Update Repository Description

In the same About section:

**Description**:
```
Privacy-first task manager using the Eisenhower Matrix. Built with Next.js, TypeScript, and IndexedDB. Works completely offline as a PWA.
```

**Website**: `https://gsd.vinny.dev`

Check:
- [x] **Use your GitHub Pages website** (if applicable)
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
