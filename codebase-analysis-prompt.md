Perform a comprehensive code quality review of this codebase.
Treat @coding-standards.md as the source of truth for design and coding standards.

Scope:
- Include: production source, tests, configuration, CI/CD definitions, infrastructure as code.
- Exclude: generated files, vendor directories, lockfiles, build artifacts.

Verify findings before reporting. If a claim depends on assumption,
mark it explicitly and lower its confidence.

Analyze across these dimensions:
1. Standards compliance with @coding-standards.md
2. Test quality and coverage, including brittleness, mocking patterns,
   and unit vs integration balance
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

For each finding, include:
- Severity: Critical, High, Medium, Low
- Confidence: High, Medium, Low
- File path and line numbers
- Specific recommendation with a short code example when useful
- Effort estimate: Small (under 1 day), Medium (1 to 5 days), Large (over 1 week)

Report structure:
1. Executive summary: overall health score from 1 to 10, top 5 risks,
   top 3 strengths, top 3 priorities for the next sprint
2. Metrics dashboard: coverage, complexity averages, dependency counts,
   debt counts, security findings by severity
3. Detailed findings grouped by dimension, sorted by severity
4. Prioritized 30, 60, 90 day remediation roadmap

Output requirements:
- Fetch https://raw.githubusercontent.com/vscarpenter/inkwell/main/agent-instructions.md
  and apply the Inkwell design system
- Save the report as codebase-analysis-report.html
- Make it executive ready: clean tables, severity color coding, collapsible
  detail sections, and anchored navigation
- Include a "Methodology and limitations" section so readers know what was
  and was not inspected
