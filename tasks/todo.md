# Status — 2026-08-16

## UI Polish Pass (/ui-craft polish) — DONE

Shipped as PR #504 (squash-merged to main as 942cab9); local + remote branch
deleted. Verified live before push (SW busted, DOM assertions, clean console).

## gsd-mcp-server 1.2.4 publish — DONE

npm serves 1.2.4 (latest); GitHub Packages published.

- Leaked npm token: REVOKED by user 2026-08-16. No replacement token needed —
  the workflow now uses OIDC Trusted Publishing (see below). The dead
  `NPM_TOKEN` GitHub secret can be deleted (`gh secret delete NPM_TOKEN`).

## OIDC Trusted Publishing — workflow side DONE, npmjs.com side PENDING (user)

publish-mcp-server.yml now authenticates to npmjs via OIDC: Node 24 (npm
≥11.5.1), no NPM_TOKEN, no registry-url on the npmjs setup-node (its .npmrc
would reference an unset ${NODE_AUTH_TOKEN} and npm errors). GitHub Packages
leg unchanged (GITHUB_TOKEN). Guard test added to
security-hardening-scripts.test.ts.

Before the next `mcp-v*` release the user must configure the trusted
publisher on npmjs.com (package gsd-mcp-server → Settings → Publishing
access): GitHub Actions / vscarpenter / gsd-task-manager /
`publish-mcp-server.yml` / environment `mcp-release`. Until then a publish
fails auth — that failure is the expected signal that config is missing.

## Working-tree leftovers (deliberate, uncommitted on main)

bun.lock + package.json (stagehand ^4.0.1 bump) and public/sw.js
(CACHE_VERSION 12.0.1) — pre-staged version-bump material from a prior
session; commit them with the next release, not with feature work.
