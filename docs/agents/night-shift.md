# Night shift — discovery-only security boundary

The scheduled night shift no longer executes pull-request code. With
`GSD_TRIAGE_BOT_LOGIN` configured, `scripts/triage-run.sh` may perform read-only
discovery of failing `claude/*` pull requests, but it never creates a worktree,
checks out a head, invokes Claude, or runs branch-controlled build tools.

Discovery requires all of:

- a same-repository pull request;
- the exact configured bot login;
- a valid immutable 40-hex head SHA; and
- at least one failing check.

Those facts identify a candidate; they do not authorize execution.

Local remediation may be reintroduced only through an ephemeral credential-free
runner whose request is bound to a trusted bot receipt for the exact repository,
pull request, and head SHA. Any patch must return through a separately reviewed
handoff. The local `/triage-prs` command remains a refusal tombstone.
