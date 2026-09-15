# Session state, 2026-09-15 (proxy-addr advisory, AIKIDO-2026-101201)

Branch: `fix/proxy-addr-floor`, cut from `main` @ `49b543c`. Standard tier: three
files, no interface change.

Aikido flagged `proxy-addr` 2.0.7 (GHSA-jqcg-44mw-7w3h, CVE-2026-90711), reached
through the `@modelcontextprotocol/sdk` dependency on `express`. The MCP server
runs over stdio and never configures `trust proxy`, so nothing here is reachable.
The fix is lockfile hygiene so Aikido and the Security Audit workflow stay green.

The `public/sw.js` edit in the tree (13.1.1) is the build artifact of deploying
13.1.0 and stays unstaged. The pre-existing `bun update` churn in `bun.lock` was
set aside (copy in the session scratchpad) so this lock diff is proxy-addr only.
`bun update` regenerates that churn on demand.

## Plan

- [x] 1. Red: assert `overrides['proxy-addr'] === '>=2.0.8'` in
      `tests/data/security-hardening-scripts.test.ts`.
- [x] 2. Green: add the floor to root `package.json`, then `bun install`. The lock
      moves proxy-addr from 2.0.7 to 2.0.8 and nothing else.
- [x] 3. Gates: guard test, `bun install --frozen-lockfile`, `bun audit`,
      `bun run test`, `bun typecheck`, `bun lint`, `bun run build`.
- [ ] 4. Commit, push, PR, merge, fast-forward main, delete branch.

## Resuming From Here

- Done: steps 1 to 3. All gates green except the known local-only
  `service-worker-privacy` failure ("deletes legacy capture entries"), which fails
  identically against main's committed `sw.js` while CI on main @ `49b543c` is green.
- Next: push `fix/proxy-addr-floor`, open the PR, watch `gh pr checks`, merge with
  `gh pr merge --squash --admin`, fast-forward main, delete the branch.
- Note: `bun audit` and GitHub's advisory GraphQL had not ingested the CVE on
  2026-09-15; Aikido was first. The upstream HISTORY.md and the repo's
  `security-advisories` endpoint confirmed 2.0.8 as the patched release.
- Assumption: no version trio bump, matching PR #536 (a dependency-only fix that
  changes neither the shipped web bundle nor the MCP package).
