# Builder — retired security boundary

The local scheduled builder is disabled. `scripts/builder-run.sh` is an inert
tombstone and `.claude/commands/build-next.md` refuses all issue and repository
operations.

The previous design treated a workflow label as durable approval, then re-read
mutable issue content while an unattended agent held maintainer credentials.
That approval was not bound to the bytes the agent consumed.

## Required replacement design

The builder may be reintroduced only when:

- a trusted actor signs or records approval over canonical issue, risk, and plan bytes;
- the dispatcher verifies the approval and digest immediately before execution;
- the worker receives a mode-0600 immutable snapshot and cannot re-fetch mutable
  issue bodies or comments as instructions;
- execution occurs in an ephemeral credential-free runner; and
- a separate reviewed service validates and publishes the proposed patch.

Until every control is implemented and tested, labels such as `ready-for-agent`,
`plan:approved`, and `plan:revise` are workflow metadata only and never execution
authority.
