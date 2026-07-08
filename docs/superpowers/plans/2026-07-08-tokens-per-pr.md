# Tokens-per-PR Instrumentation Plan (cycle E follow-up)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Record the builder run's token cost against the PR it opens, and report tokens-per-merged-PR in telemetry.

**Global constraints:** Builder-only. Marker format exactly `<!-- gsd-tokens tokens=<n> -->`. Command reports `OPENED_PR=<n>` / `OPENED_PR=none`. `.cjs` helpers, `.test.ts` tests. Best-effort — token capture never fails a builder run. Commits: Conventional + `Vinny Carpenter <vscarpenter@gmail.com>` + `Claude-Session` trailer.

---

### Task 1: `extract-run-tokens.cjs` (TDD)

**Files:** Create `scripts/extract-run-tokens.cjs`, `tests/extract-run-tokens.test.ts`

- [ ] **Test** — `extractRunTokens(json) -> { tokens, pr }`: full usage summed (input+output+cache); missing usage → 0; `OPENED_PR=123` in result → 123; absent / `=none` → null; JSON string parsed; malformed → `{tokens:0, pr:null}`. `totalTokens`, `parsePr` exported.
- [ ] **Implement** — sum all `*_tokens` fields in `usage`; regex `/OPENED_PR=(\d+)/` on `result`; CLI mode reads stdin, prints `"<tokens> <pr|none>"`.
- [ ] **Verify** `bun run test -- tests/extract-run-tokens.test.ts` + CLI sanity.
- [ ] **Commit** `feat(pipeline): extract-run-tokens helper (claude usage -> tokens + PR)`

### Task 2: builder emits the marker

**Files:** Modify `scripts/builder-run.sh`, `.claude/commands/build-next.md`

- [ ] **build-next.md** — add a required final line: `OPENED_PR=<number>` (or `OPENED_PR=none`).
- [ ] **builder-run.sh** — invoke `claude -p "/build-next" --output-format json` (stdout→run log, stderr→`<log>.err`); pipe the JSON through `extract-run-tokens.cjs`; if a PR + non-zero tokens, `gh pr comment <pr> --repo "$REPO" --body "<!-- gsd-tokens tokens=<n> -->"` (best-effort).
- [ ] **Verify** `bash -n scripts/builder-run.sh`; `grep -q "OPENED_PR" .claude/commands/build-next.md`.
- [ ] **Commit** `feat(pipeline): builder records run tokens as a PR marker`

### Task 3: telemetry reads markers + computes tokensPerPR

**Files:** Modify `.github/workflows/telemetry.yml`, `scripts/telemetry-metrics.cjs`, `tests/telemetry-metrics.test.ts`

- [ ] **telemetry-metrics test** — update empty case to `tokensPerPR: {mean:null, count:0}`; add: mean over PRs with numeric `tokens`; PRs without tokens excluded. Run → fail.
- [ ] **telemetry-metrics.cjs** — `tokensPerPR = merged with numeric tokens → {mean: round(sum/n,0), count} else {mean:null,count:0}`.
- [ ] **telemetry.yml** — per PR, `listComments`, sum `<!-- gsd-tokens tokens=(\d+) -->` → `pr.tokens` (null if none; errors `core.warning`ed); dashboard row shows `tokensPerPR.mean (n=count)`.
- [ ] **Verify** `bun run test -- tests/telemetry-metrics.test.ts`; `telemetry.yml` parses.
- [ ] **Commit** `feat(pipeline): telemetry sums token markers into tokensPerPR`

---

## Full-suite verification
- [ ] `bun run test -- tests/extract-run-tokens.test.ts tests/telemetry-metrics.test.ts` green.
- [ ] `bun run lint` no new errors; `bash -n scripts/builder-run.sh`; both YAML parse.

## Self-review
Spec §1→T1, §2→T2 (build-next), §3→T2 (builder-run), §4→T3 (telemetry), §5→T3 (metrics). Marker string identical across builder-run.sh (write) and telemetry.yml (read). `OPENED_PR=` identical across build-next.md and extract-run-tokens.cjs.
