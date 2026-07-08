# Gate 2 — Release approval runbook

Gate 2 is the second and final human approval in the delivery pipeline (cycle C). It is the moment you approve **production**, having tested the running software. Gate 1 (plan approval) happens earlier, before code exists; this is the release gate.

**Policy:** no rollback path, no approval. The evidence below always includes the exact rollback command; if it cannot, do not approve.

## The release path

```
PR: CI green + reviewer ran + 0 unresolved threads
      └─▶ release-ready.yml adds `release-ready` + a summary comment
YOU merge the PR ─▶ deploy-dev.yml auto-deploys main to the DEV environment
YOU test the dev URL (this is the "test the running software" step)
/release ─▶ bumps version, tags v*.*.* ─▶ deploy-prod.yml runs:
   1. evidence job (ungated)  — writes version + rollback command to the run summary
   2. deploy job              — PAUSES at the `production` Environment gate   ← GATE 2
      └─▶ YOU read the evidence, approve ─▶ S3 + CloudFront ─▶ smoke-test.sh
```

The preview you test is the **dev environment** (populated the moment you merge). There is no separate ephemeral preview by design.

## What the evidence job shows (read this before approving)

When `deploy-prod` runs, the **Gate 2 — release evidence** job completes before the gate. Open the run and read its summary:

- **Deploying:** the version this deploy will ship (`vX.Y.Z`).
- **Previous prod:** the last released version — the rollback target.
- **Rollback command:** the exact one-liner to redeploy the previous release. Copy it somewhere before approving.
- **Preview:** the dev URL you should already have tested.
- **Post-deploy:** `smoke-test.sh` runs automatically against the live site after the CloudFront invalidation completes, proving the deploy rather than assuming it.

Then approve the `production` environment deployment (GitHub UI or mobile app). Only after approval does anything touch prod.

## Rollback

Rollback = redeploy the previous release tag through the **same gated** `deploy-prod` path (a deterministic rebuild):

```bash
gh workflow run deploy-prod.yml --ref v9.3.2   # example: previous release was v9.3.2
```

This still pauses at the Gate 2 `production` approval, so a rollback is a deliberate, gated action too. The evidence job prints the correct `--ref` for the current deploy; use that value.

If there is no previous release (first-ever deploy), roll back by redeploying an earlier known-good commit.

## Notes

- `release-ready` is computed by `release-ready.yml`, not by the reviewer — the reviewer only posts findings (which become threads that block both `release-ready` and merge until resolved).
- GitHub emits no event when a review thread is *resolved*, so after you resolve the last thread, `release-ready` re-evaluates on the next push / review / CI run. In practice you resolve a thread by pushing a fix, which retriggers it.
- The builder (cycle B) never merges or deploys and never edits `deploy-prod.yml` — Gate 2 is always yours.
