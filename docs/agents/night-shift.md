# Night shift — discovery-only security boundary

The scheduled night shift no longer executes pull-request code. With
`GSD_TRIAGE_BOT_LOGIN` configured, `scripts/triage-run.sh` may perform read-only
discovery of failing `claude/*` pull requests, but it never creates a worktree,
checks out a head, invokes Claude, or runs branch-controlled build tools.

An open pull request counts as a candidate only when it has all of:

- a head branch that starts with `claude/`;
- a head branch in this repository, not a fork;
- the configured bot login as the author (the match ignores case);
- a valid immutable 40-hex head SHA; and
- at least one failing check.

Those facts identify a candidate; they do not authorize execution.

The script names no pull request. It reports that no candidate exists, or how
many do. If the counting helper cannot run, it reports the count as unavailable. With
`GSD_TRIAGE_BOT_LOGIN` unset it exits before any lookup. An open issue labeled
`triage:paused` stops the run before discovery. If that label lookup fails, the
script logs the failure and discovery still runs. A failed `gh pr list` call is
logged and reports no work. `scripts/triage-run.sh` owns the exact status lines.

Local remediation may be reintroduced only through an ephemeral credential-free
runner whose request is bound to a trusted bot receipt for the exact repository,
pull request, and head SHA. Any patch must return through a separately reviewed
handoff. The local `/triage-prs` command remains a refusal tombstone.
