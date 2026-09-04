---
name: triage-prs
description: Retired local remediation entry point. It refuses to execute PR branches on the maintainer host.
---

# /triage-prs

Stop without checking out, building, testing, or modifying any pull-request branch.

The local night-shift remediation loop is retired. A same-repository branch name
does not establish trust, and maintainer credentials must never be inherited by
branch-controlled code.

The remaining scheduled wrapper performs read-only discovery only. Re-enabling
remediation requires an exact configured bot identity, an immutable head-SHA
attestation, and an ephemeral credential-free runner. Outputs from that runner
must return through a separately reviewed handoff.

Report: `DISABLED: local branch remediation is retired.`
