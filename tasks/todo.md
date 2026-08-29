# Session state — 2026-08-28 (path move + parity shipping + merges)

## Resuming From Here

Merged (all squash):
- web #520 backup interop + Apple sign-in + reminders + import-cap fix → 65f15b6
- iOS #10 full-fidelity backups + trash (merged from GitHub UI by Vinny)
- web #521 retire half-wired plumbing + docs truth → e332f5b
- web #522 sound + quiet-hours controls → e8d793a
- Post-merge main verified green: 2877 tests, typecheck, shape ratchet.

CI notes for next time:
- The pre-push gate must include `bun run quality:shape` — the CI lint job runs
  it and it is a required check. Both #520 and #522 needed shape-fix commits.
- Repo ruleset requires code-owner review, which the owner can't self-satisfy;
  owner PRs merge with `gh pr merge --admin`.
- SonarCloud (new-code coverage 80%) is advisory, not required.

Still open:
- Unpushed path-fix branches: web chore/gsd-workspace-paths (2 commits),
  iOS chore/gsd-workspace-paths (1 commit), usage repo main (local-only).
  Until the web one lands, main's builder-run.sh SOURCE default still names
  the old path (installed launchd plists already fixed).
- iOS import cap still counts tasks only — needs its own iOS change.
- User to run: claude mcp add --scope local --transport http sentry https://mcp.sentry.dev/mcp
- Claude Desktop config still lists old workspace paths (edit after quitting app).
- Other sessions' iOS branches fix/capture-parser-parity + fix/reminder-options-parity
  merged as #11/#12; their local branches remain (not this session's to clean).
