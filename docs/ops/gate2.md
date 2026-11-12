# Gate 2 — Release approval runbook

Gate 2 is the final human approval for production. CI, artifact creation, and
artifact signing do not authorize AWS access. Only the production environment
reviewer can release the verified artifact.

Policy: no validated rollback tag, no approval.

The retired .github/workflows/deploy-prod.yml path must stay absent. Its
historical tagged copies accepted manual refs. Production now uses the distinct
.github/workflows/deploy-production-release.yml identity with no
workflow_dispatch trigger. It runs on a release-tag push or on the
deploy-production-release repository-dispatch event used for rollback.

The development deploy (.github/workflows/deploy-dev.yml) was retired on
2026-09-11. Production is the only deploy target, so there is no hosted preview
between merge and release.

## Release path

~~~
PR: required CI green + required human review + no unresolved threads
YOU merge the PR
/release creates vX.Y.Z at a protected main commit
deploy-production-release:
  1. audit    — run the security audit workflow (security-audit.yml)
  2. evidence — authorize the immutable tag/main commit and print the rollback command
  3. build    — build and package with no OIDC, environment, or AWS authority
  4. attest   — sign provenance with GitHub's short-lived Sigstore identity
  5. deploy   — pause at production Gate 2, verify, then obtain AWS OIDC
  6. smoke    — verify the live surface without cloud credentials
~~~

## Evidence to review

Before approving production, confirm:

- the semantic release tag and exact commit;
- the commit is reachable from protected main;
- the tag version matches package.json;
- the prior immutable release tag is a valid rollback target; and
- the build job had no OIDC or AWS authority and provenance verification is
  required before AWS credential configuration.

The production environment gate occurs after build and attestation. Rejecting the
deployment consumes no AWS credentials and changes no cloud state.

## Rollback

Dispatch the same gated workflow for an existing previous release tag:

~~~bash
gh api --method POST repos/vscarpenter/gsd-task-manager/dispatches \
  -f event_type=deploy-production-release \
  -F 'client_payload[ref]=refs/tags/vX.Y.Z'
~~~

Replace vX.Y.Z with the earlier release tag. When an earlier tag exists, the
evidence summary of a run prints this command with that tag filled in.

The security audit job runs first on a rollback too. A dispatch run audits the
default branch, not the rollback tag, so a failing audit on main blocks the
rollback.

The workflow rejects arbitrary commits and branches. It validates the tag,
requires its commit to be on main, rebuilds without cloud authority, signs the
artifact, and pauses at Gate 2. If no earlier release tag exists, stop and create
a separately reviewed recovery plan.

## Required GitHub environment policy

- production: permit protected main/release-tag contexts only; retain the
  vscarpenter required reviewer.

The local unattended builder is retired; workflow labels do not authorize code
execution or deployment.
