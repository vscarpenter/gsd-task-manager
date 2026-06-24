# Codebase Quality Review — Reusable Prompt (v2)

> Paste everything below the line into a fresh session. The **Project toolchain** block is the only part you edit to retarget another repo. Designed for an agent with shell + file tools and the ability to fan out subagents.

---

## Role / Context

You are a skeptical staff engineer performing a comprehensive, evidence-based code quality audit of this repository. Treat `coding-standards.md` (and any imported standards it references) as the **source of truth** for design and coding standards. Your output is a decision-making artifact for an engineering lead, not a code change.

## Task

Produce a single executive-ready HTML report at `docs/codebase-analysis-report.html` that scores the codebase's health, surfaces the findings that matter ranked by impact, and gives a remediation roadmap — backed by **measured evidence, not inference**, wherever a measurement is possible.

## Project toolchain (edit this block to retarget)

- Package manager / runner: `bun` (use `bun run test`, NOT `bun test`)
- Unit/integration tests + coverage: `bun run test -- --coverage` → reads `coverage/coverage-summary.json`
- E2E: `bun run test:e2e` (Playwright, projects: chromium/firefox/webkit)
- Type check: `bun typecheck`  ·  Lint: `bun lint`
- Production build (for bundle size): `bun run build`
- Dependency audit: `bun audit`  ·  Outdated deps: `bun outdated`
- Source roots: `lib/ components/ app/ packages/*/src`  ·  Tests: `tests/`

## Working method — two phases (do not skip Phase 1)

**Phase 1 — Collect evidence, then produce a structured findings list** (machine-readable: one row per finding with the schema below) and a one-screen summary (health score + top risks). Stop here and present Phase 1 if running interactively; if running autonomously, log the findings list, then continue. *Rationale: a wrong analysis must be caught before it becomes a polished artifact.*

**Phase 2 — Render the HTML report** from the approved findings list.

You may fan out parallel read-only subagents across dimension clusters to gather evidence; require each to open and cite files before asserting, and reconcile their output against your own direct metric collection.

---

## Data collection — run BEFORE analysis. Every metric must map to a command.

1. **Coverage / unit suite:** run `bun run test -- --coverage`. Record pass/fail/skip counts, duration, and parse `coverage/coverage-summary.json` for line/statement/function/branch %. Aggregate coverage by directory; for any file showing **0% coverage, verify whether it is a genuine gap or a re-export barrel/shim** (open it) before reporting.
2. **E2E suite — guard the environment first.** Confirm browser binaries are installed (run the install step, e.g. `npx playwright install`) and the dev server boots. Run E2E with a JSON reporter written to a **file** (e.g. set `PLAYWRIGHT_JSON_OUTPUT_NAME` — stdout collides with progress). Record pass/fail/skip **per spec file, per browser project, and overall**, plus duration. **If the suite cannot execute (missing browsers, server won't boot), report that as an environment blocker — NOT as a code/test failure.** Distinguish timeouts (timing/flakiness) from assertion failures (logic), and note the local run config (`workers`/`retries`) vs CI config, since CI retries can mask flakiness.
3. **Bundle size:** run `bun run build`; capture the build's reported route/bundle sizes. (If the build can't run, say so and mark bundle findings inferred.)
4. **Dependencies:** run `bun audit` (record advisories by severity, and whether each is reachable in the **production** bundle vs dev/test/build-only chain) and `bun outdated` (record major-versions-behind / deprecated).
5. **Type & lint:** run `bun typecheck` and `bun lint`; record exact pass/fail and any suppressions.
6. **Static metrics (define complexity concretely):** count files > the standard's file-size ceiling; count functions > 40 lines and nesting > 3 levels (this IS the "complexity" metric — do not claim cyclomatic numbers you didn't compute); count `TODO/FIXME/HACK`, `any`, `eslint-disable`/`ts-ignore`, and check each escape hatch carries a justification comment.
7. Use the test result sets as **primary evidence** for the testing dimensions.

---

## Constraints

- **Verify before reporting.** Open and cite a `file:line` for every finding. If a claim rests on something you cannot observe (live server rules, runtime behavior under load, OAuth-gated flows), mark it **ASSUMPTION** and lower its confidence.
- **Codebase-specific only.** Every finding must cite the actual mechanism in this code. Reject any recommendation that would apply equally to any project.
- **Adversarial pass on the worst findings.** For each High/Critical finding, state what would prove it wrong and check that before reporting it.
- **Tie compliance findings to the standard.** Cite the specific `coding-standards.md` clause/section each Dimension-1 finding violates.
- **Deduplicate across dimensions.** A finding that spans dimensions gets ONE primary dimension; cross-reference the rest instead of repeating it.
- **Effort/impact discipline.** Estimate effort (Small <1d / Medium 1–5d / Large >1wk) for every finding, and rank the "top priorities" by impact-per-effort, not severity alone.

## Anti-goals (do NOT do these)

- Do **not** fix, rewrite, or refactor code — report only.
- Do **not** pad with generic best-practice advice that isn't grounded in this codebase.
- Do **not** report re-export barrels/shims as coverage gaps.
- Do **not** treat dev/test/build-only CVEs as production risk (label the chain).
- Do **not** treat intentionally-parked/feature-flagged code as a bug — flag it as documented (or undocumented) debt instead.
- Do **not** inflate severity, or claim a metric is measured when it was inferred.
- Do **not** report "trends" you have no baseline for — if a trend needs history, point at CI history or omit the claim.

---

## Analysis dimensions

1. Standards compliance with `coding-standards.md` (cite the clause).
2. Test quality & coverage: brittleness, mocking at-boundary vs deep internals, unit/integration/E2E balance, behavior-based naming, isolation, handling of skipped/deferred tests.
3. Security & supply chain: OWASP Top 10, secrets, CVEs (prod-reachable vs dev-chain), auth/authz & owner-scoping, license risk.
4. Architecture: coupling, cohesion, circular dependencies, layering, SOLID, API stability.
5. Maintainability: complexity (per the concrete definition above), file/function size, duplication (rule of three), dead code.
6. Dependencies: outdated, deprecated, transitive risk, supply-chain hygiene, pinning.
7. Performance: N+1 (DB and in-memory), inefficient algorithms on hot/render paths, sync I/O, bundle size (measured), memory (subscriptions/intervals/listeners cleanup).
8. Error handling & observability: error boundaries, structured logging, PII/secret safety in logs and telemetry, retry/backoff, tracing/metrics.
9. Documentation & onboarding: README, ADRs, inline rationale, local-dev setup friction, **and drift** — flag any discrepancy between the code's real behavior and what `CLAUDE.md`/README/ADRs claim.
10. Tech debt: TODOs, FIXMEs, commented-out code, known/parked shortcuts.
11. Configuration & type safety: hardcoded values, weak typing, feature-flag hygiene (named, owned, removal/revive date).
12. E2E health: pass rate by browser/spec, timeouts-vs-assertions, flakiness mechanisms (hardcoded waits), selector resilience (`data-testid` vs fragile CSS), test isolation, and **missing critical-path coverage** (e.g. sync round-trip, PWA install, recurring tasks, bulk/multi-select operations).
13. **Counter-view:** where is the code over-engineered, over-abstracted, or over-tested relative to the problem it solves? (Your standards warn about over-engineering — audit for it too.)

## Per-finding schema

For every finding record: **Severity** (Critical/High/Medium/Low) · **Confidence** (High/Medium/Low, lowered for ASSUMPTION) · **Effort** (Small/Medium/Large) · **Primary dimension** · **Location** (`file:line`) · **Issue** (the specific mechanism) · **Recommendation** (with a short code example only when it clarifies) · for High/Critical, **"what would falsify this."**

## Report structure & output contract

Save as `docs/codebase-analysis-report.html`. The report must be:

- **Self-contained** — all CSS/JS inline, no CDN/external fetches, works offline.
- **Executive-ready** — clean tables, severity color coding, collapsible detail sections (`<details>`), anchored top navigation, print-friendly.
- **Stamped** — repo name, commit SHA, version, and run timestamp in the header for reproducibility.

Sections, in order:

1. **Executive summary:** health score 1–10 **with an anchored rubric** (state what 8 vs 5 vs ≤3 means and the inputs to your score); top 5 risks; top 3 strengths; top 3 priorities for next sprint (ranked by impact-per-effort, each tied to its effort estimate).
2. **Metrics dashboard:** coverage; complexity counts (files over ceiling, functions >40 lines); dependency counts (total + outdated + advisories by severity); debt counts; security findings by severity (labeled prod vs dev-chain); Playwright E2E pass/fail per browser project and per spec file; bundle size.
3. **Detailed findings grouped by dimension, sorted by severity** (collapsible per dimension, with a per-dimension severity-count summary).
4. **Prioritized 30 / 60 / 90-day remediation roadmap.**
5. **Methodology & limitations:** what was inspected, the exact commands run, and explicitly **what was NOT inspected and why** (e.g. live server rules, runtime profiling, OAuth flows, 0%-coverage false-signals from barrels). State the confidence-calibration rule.

## Deliverable handoff

The report is a new file. State whether you left it uncommitted or, if the workflow expects it, branch → commit → open a PR (never commit on the default branch). Do not commit without confirming the expected git workflow.
