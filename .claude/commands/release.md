---
name: release
description: Run the standard release flow — bump version, commit, push, open PR, merge, tag, create GitHub release. Use when shipping a new version of gsd-taskmanager.
argument-hint: "<patch|minor|major|x.y.z>"
---

# /release

Release the gsd-taskmanager app or MCP server. Replaces the recurring "bump version to N, commit, push, PR, merge, tag, GH release" manual flow.

## Inputs

`$ARGUMENTS` is either:
- `patch` / `minor` / `major` — bump the matching SemVer segment of `package.json` (workspace root).
- An explicit version like `9.4.0` — pin to that exact value.

## Steps

1. **Branch preflight** — confirm working tree is clean (`git status --porcelain`). If dirty, ask whether to stash or include changes.
2. **Branch creation** — if on `main`, create `chore/release-<version>`. (The `no-main-commits.sh` hook will block otherwise.)
3. **Version bump** — update `package.json` and `packages/mcp-server/package.json` if the MCP server is part of the release. Use `npm version --no-git-tag-version` or edit directly.
4. **Verification gate** — run `bun typecheck && bun lint && bun run test`. Halt if any fail.
5. **Commit** — `chore(release): vX.Y.Z` with a body listing the user-visible changes since the previous tag (`git log --oneline <prev-tag>..HEAD`).
6. **Push and PR** — push the branch, open a PR titled `Release vX.Y.Z` with the changelog as the body.
7. **Wait for review or self-merge** — if the user has authority, ask whether to merge immediately.
8. **Tag** — after merge, `git fetch origin main`, `git tag vX.Y.Z`, `git push origin vX.Y.Z`.
9. **GitHub release** — `gh release create vX.Y.Z --generate-notes --title "vX.Y.Z"`.
10. **MCP publish (if applicable)** — if the MCP server bumped, run `npm publish` from `packages/mcp-server/` (requires `npm login`).

## Anti-goals

- Don't run on a dirty working tree without explicit user OK.
- Don't push tags before the version-bump PR is merged.
- Don't publish to npm without user confirmation — that step is hard to reverse.

## Verification before declaring done

- [ ] Version bump merged on `main`.
- [ ] Tag exists on remote.
- [ ] GitHub release page shows the new version.
- [ ] If MCP server was published, `npm view @vscarpenter/gsd-mcp-server version` returns the new value.
