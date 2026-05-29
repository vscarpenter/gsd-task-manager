Role: You are a skeptical staff engineer performing a read-only audit.
Report ALL findings, tagged by severity. Do not filter or self-censor based on
perceived severity — a thorough low-severity list is more useful than a curated one.

Perform a comprehensive code quality review of this codebase.
Treat @coding-standards.md as the source of truth for design and coding standards.

Scope:
- Include: production source, tests (unit, integration, and E2E), configuration,
  CI/CD definitions, infrastructure as code. Note: this is a static-export Next.js
  PWA deployed via shell scripts (scripts/deploy-*.sh); there is no Terraform/CDK,
  so the "infrastructure as code" surface is limited to those scripts and config.
- Exclude: generated files, vendor directories, lockfiles, build artifacts.

Anti-goals (read-only review):
- Do NOT modify, refactor, or "fix" any source, test, or config file.
- The ONLY file this task writes is the HTML report named below.
- Return findings as a structured report, not as code changes or diffs.

Verify findings before reporting. If a claim depends on assumption,
mark it explicitly and lower its confidence.

Data collection — run before analysis:
1. Run `bun run test -- --coverage` and capture Vitest unit/integration
   results and the coverage summary from coverage/coverage-summary.json.
2. Prerequisite: ensure all three browsers are installed, or the firefox/webkit
   projects fail to launch and corrupt the cross-browser data:
   `npx playwright install chromium firefox webkit`.
   Then run the E2E suite, capturing JSON to a file (the json reporter writes to
   stdout unless PLAYWRIGHT_JSON_OUTPUT_NAME is set, and the multi-reporter CLI
   form is comma-separated, not a repeated flag):
   `PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/e2e.json PLAYWRIGHT_HTML_OPEN=never bun run test:e2e -- --reporter=json,html`
   Record pass/fail/skip counts per spec file (tests/e2e/*.spec.ts), per browser
   project (chromium, firefox, webkit), and overall duration. If any tests fail,
   include the failure messages and affected spec files in the report. If a
   browser cannot be installed/launched in this environment, say so explicitly
   and mark that project's data as "not collected" rather than "failed".
3. Use both result sets as primary evidence for dimensions 2 and 12 below.

Analyze across these dimensions:
1. Standards compliance with @coding-standards.md
2. Test quality and coverage, including brittleness, mocking patterns,
   and unit vs integration vs E2E balance. Evaluate Playwright E2E specs
   for workflow coverage (CRUD, navigation, search, settings, quadrant
   classification), cross-browser results, flakiness, and use of Page
   Object Model (tests/e2e/pages/) and test fixtures (tests/e2e/fixtures/).
3. Security and supply chain: OWASP Top 10, secrets, CVEs, license risk,
   auth and authz patterns
4. Architecture: coupling, cohesion, circular dependencies, layering,
   SOLID, API stability
5. Maintainability: cyclomatic and cognitive complexity, file and function
   size, duplication, dead code
6. Dependencies: outdated, deprecated, transitive risk, supply chain hygiene
7. Performance: N+1 queries, inefficient algorithms, sync I/O on hot paths,
   bundle size, memory concerns
8. Error handling and observability: error boundaries, structured logging,
   PII safety, tracing and metrics
9. Documentation and onboarding: README, ADRs, inline rationale, local
   dev setup friction
10. Tech debt: TODOs, FIXMEs, commented-out code, known shortcuts
11. Configuration and type safety: hardcoded values, weak typing, feature
    flag hygiene
12. E2E test health: Playwright pass rate by browser, per-spec and per-project
    duration for THIS run (a single run is one data point, not a trend — only
    report "trends" if a historical baseline or CI artifact is available, else
    report absolute durations and say so), missing critical-path coverage (e.g.,
    sync, PWA install, recurring tasks, bulk operations), selector resilience
    (data-testid vs fragile CSS), and test isolation (IndexedDB cleanup between runs)

For each finding, include:
- Severity: Critical, High, Medium, Low
- Confidence: High, Medium, Low
- File path and line numbers
- Specific recommendation with a short code example when useful
- Effort estimate: Small (under 1 day), Medium (1 to 5 days), Large (over 1 week)

Report structure:
1. Executive summary: overall health score from 1 to 10, top 5 risks,
   top 3 strengths, top 3 priorities for the next sprint.
   Use this rubric so the score is reproducible:
     9-10 = no Critical/High findings; coverage ≥80%; deps current, no known CVEs.
     7-8  = no Critical; ≤2 High; coverage ≥80%; minor debt only.
     5-6  = ≤1 Critical or several High; coverage 60-80%; notable debt.
     3-4  = multiple High/Critical; coverage <60% or failing tests.
     1-2  = Critical security/data-loss risk or broken build/test suite.
2. Metrics dashboard: coverage, complexity averages, dependency counts,
   debt counts, security findings by severity, Playwright E2E pass/fail
   counts per browser project and per spec file
3. Detailed findings grouped by dimension, sorted by severity
4. Prioritized 30, 60, 90 day remediation roadmap

Output requirements:
- Fetch https://raw.githubusercontent.com/vscarpenter/inkwell/main/agent-instructions.md
  and apply the Inkwell design system. If the fetch fails (404, network), fall back
  to the local `inkwell-retrofit` skill or a minimal self-contained stylesheet, and
  note the fallback in the Methodology section.
- Save the report as docs/codebase-analysis-report.html. Note: this path already
  exists and is tracked in git — this run intentionally overwrites the prior report
  (it is the canonical location). Do not datestamp unless asked.
- Make it executive ready: clean tables, severity color coding, collapsible
  detail sections, and anchored navigation
- Include a "Methodology and limitations" section so readers know what was
  and was not inspected
