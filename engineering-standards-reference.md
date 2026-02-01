# Engineering Standards Reference

*Team process standards and operational guidelines. This document is a reference for engineering practices and is not loaded into every Claude Code session. Claude can read this file on request.*

---

## Release & Operations

### Deployment

- Use feature flags (start OFF, roll out gradually)
- Maintain backward compatibility with existing APIs and data
- Include rollback scripts for DB migrations
- Require passing CI/CD checks before merge
- Services must be healthy before receiving traffic

### Rollback & Monitoring

- **15-minute rule:** Roll back if not fixed in 15 minutes
- Auto-rollback on greater than 5% error rate or 2x latency
- Structured JSON logs with correlation IDs
- Track the Four Golden Signals (latency, traffic, errors, saturation)
- Add metrics for key business KPIs
- Document alert thresholds

---

## Collaboration

### Code Reviews

- Keep PRs to 400 lines or fewer
- Review for correctness first, style second
- Give constructive feedback with examples
- Include context in PR descriptions

### Documentation

- README: setup and run instructions
- Inline comments for complex logic
- Architecture Decision Records (ADRs) for major choices
- Keep docs near code

### Version Control

- Use semantic versioning (MAJOR.MINOR.PATCH)
- Clear, imperative commit messages (use conventional commits if possible)
- Protect main/master branches
- Squash merges; tag releases consistently

---

## Technical Debt

- Mark debt with TODO or FIXME plus ticket number
- Review and prioritize quarterly
- Pay down high-interest debt first (security, performance)
- Allocate approximately 20% sprint capacity for debt reduction
- Record debt decisions in ADRs

---

*Companion to Code Standards & Agentic Guidance v5.0 | Vinny Carpenter*
