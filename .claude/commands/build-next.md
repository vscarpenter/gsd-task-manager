---
name: build-next
description: Retired unattended builder entry point. It refuses execution until immutable approval and credential-free isolation exist.
---

# /build-next

Stop without reading, selecting, or modifying any issue.

The local unattended builder is retired because mutable issue content could drive
an agent holding maintainer credentials. Do not invoke Claude, repository tools,
GitHub mutations, or another agent.

Re-enabling this command requires all of the following:

1. trusted-actor approval bound to canonical immutable issue and plan bytes;
2. digest verification immediately before dispatch;
3. exclusive consumption of the verified snapshot, never a live re-fetch; and
4. execution in an ephemeral credential-free runner with a reviewed output handoff.

Report: `DISABLED: unattended builder execution is retired.`
