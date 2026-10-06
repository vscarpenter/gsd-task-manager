# Spec: modernization Phase 2, close the repo's security findings

Date: 2026-10-05. Tier: non-trivial. The approved design is
`../gsd-modernize/analysis/gsd-taskmanager/MODERNIZATION_BRIEF.md` §3 Phase 2,
with the owner's decisions of 2026-10-05 recorded in its §7. The findings are in
`SECURITY_FINDINGS.md` in the same folder. Where this spec and the brief differ,
the brief wins.

## Goal

Close SEC-002, SEC-011, SEC-025, SEC-027, SEC-028, and SEC-030 inside this repo,
one branch and one PR per finding, with every P0 rule still passing.

## Owner decisions (2026-10-05)

- SEC-002: plain sign-out stays local. A new "Sign out of all devices" action
  rotates the user's PocketBase token key, which ends every session for that
  user. Switching accounts doesn't rotate automatically (the old token is gone
  by then); the cross-account sign-in error points to the explicit action.
- SEC-002 reach: the self-host image only. Production runs a bare PocketBase
  with no hooks (ADR 0016), so when the route answers 404 the app falls back to
  local sign-out and tells the user.
- SEC-030: Claude adds `audit` to the `main-protection` required checks with
  `gh api`, and shows the before and after.

## Units

| Finding | Branch | Change | Test that fails on today's code |
|---|---|---|---|
| SEC-025 | `chore/pocketbase-0-40-4` | PocketBase 0.40.4 in `docker/Dockerfile`, both SHA-256 pins, the pin test, `docker/README.md` | The pin test expects 0.40.4 |
| SEC-002 | `feat/sign-out-everywhere` | A hook route that rotates the caller's token key; a client call; "Sign out of all devices" in the sync dialog; 404 fallback; a pointer from the cross-account error | Hook adapter test, client test, and UI test |
| SEC-011 | `fix/redact-task-content-logs` | Task logs carry ids only; content keys join the logger's redaction pattern; `lib/error-logger.ts` masks through `lib/logger.ts` | Logger and CRUD log tests |
| SEC-027 | `chore/dockerignore-nested-env` | Depth-agnostic `.env` patterns and agent folders in `.dockerignore` | Guard test on `.dockerignore` |
| SEC-028 | `chore/next-16-3-8` | `next` and `eslint-config-next` to 16.3.8 or later, together | Guard test on both versions |
| SEC-030 | `ci/audit-before-deploy` | `security-audit.yml` callable; every deploy and publish workflow needs it first; `audit` required in `main-protection` | Workflow guard test |

## Constraints

- One branch per unit, cut from current `main`. Test first for each.
- No production infrastructure changes. The ruleset change is the one GitHub
  setting the owner approved.
- A build, when needed, runs scrubbed (`env -i HOME="$HOME" PATH="$PATH"`), and
  its rewrites of `public/sw.js`, `package.json`, and `bun.lock` are discarded.
- Dependency changes are made with bun 1.3.14 and verified in a clean frozen
  install.
- No per-PR version bump. A release PR follows the phase.

## Out of scope

- Deploying hooks or upgrading PocketBase on production (§7 backend decision).
- Shortening the token lifetime, which the owner's choice didn't include.
- An OSV-based scan (named in the finding's fix, not in the exit criteria).

## Acceptance criteria (brief Phase 2 exit criteria)

1. SEC-002 as revised by the owner's choice: "Sign out of all devices" ends the
   user's sessions on the self-host server, with a test that fails on today's
   code.
2. SEC-025: the self-host image runs PocketBase 0.40.4 or later, and
   `pocketbase-system` CI passes on it.
3. SEC-030: `audit` is required by `main-protection` and runs before every
   deploy and publish.
4. SEC-011: production logs carry no task titles, and `lib/error-logger.ts`
   masks through `lib/logger.ts`.
5. SEC-027 and SEC-028: `.dockerignore` excludes `docker/.env`, and `next` is on
   16.3.8 or later.
6. Every P0 rule in brief §5 still passes: both suites green on every branch.
