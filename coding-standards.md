# Code Standards & Agentic Guidance

*Comprehensive guidance for AI-assisted development*

---

## Part 1: Agentic Behavior Guidelines

These directives govern how LLMs should approach complex, multi-step tasks requiring sustained autonomous work.

### Context Management & Sustained Work

For lengthy tasks, follow these requirements:

1. Before writing code, outline your implementation plan with clear milestones.
2. Work systematically through each milestone, committing functional changes frequently.
3. Commit at least every significant component or logical unit of work.
4. Monitor your context usage and prioritize committing working code before context exhaustion.
5. Never leave significant work uncommitted.

> **Critical:** If you find yourself 80% through context with major uncommitted work, stop adding features and commit immediately.

### Reflection After Tool Results

After each tool result, pause to evaluate before proceeding:

- Did the operation succeed or fail?
- Does the output match expectations?
- Are there edge cases or errors to address?
- What is the root cause if results are unexpected?

Use extended thinking to analyze results and plan your next action. If results are unexpected, diagnose the root cause before attempting fixes. Avoid repeated trial-and-error changes without understanding the underlying issue.

### Solution Quality Requirements

Every solution must meet these standards:

- Implement robust, general-purpose logic that handles all valid inputs correctly
- Avoid hardcoded values, magic numbers, or logic tailored to specific test inputs
- Include appropriate error handling and input validation
- Use standard tools and language features rather than external workarounds
- Code should be maintainable, readable, and follow established conventions

> **Never:** Create solutions that only work for specific test cases. Always implement the actual algorithm or business logic.

### Incremental Progress

Build incrementally to ensure quality:

- Get a minimal working version first, then extend
- Avoid writing large amounts of code before testing any of it
- After implementing, verify your solution works by running tests or manual checks
- Do not assume code is correct without execution
- If tests fail, analyze the failure before making changes

---

## Part 2: Code Quality Standards

### Core Principles

1. **Simplicity over cleverness.** Prefer clarity to novelty.
2. **Build small, iterate fast.** Deliver working code before optimizing.
3. **Code for humans.** Code must be readable by a junior engineer without needing to scroll to other files.
4. **Prefer boring tech.** Stability over hype.
5. **Automate consistency.** Enforce linting, tests, and formatting in CI.
6. **Standard Lib > External:** Always choose the language's standard library over an external dependency unless the standard library requires >2x the amount of code to achieve the same result.

### Naming & Clarity

- Use descriptive names; avoid generic terms like 'data', 'temp', or single letters
- Functions should be 30 lines or fewer with single responsibility
- Maximum 3 levels of nesting; use early returns
- Comments explain WHY, not WHAT
- Limit files to approximately 350-400 lines; split by responsibility

### Structure & Abstraction

- Apply DRY only after 3+ repetitions
- Follow YAGNI: do not build for hypothetical futures
- Prefer composition over inheritance
- Duplicate if it is clearer than abstracting
- No magic numbers; use named constants
- Inject dependencies (I/O, time, randomness)

### Guardrails

- Validate inputs, sanitize outputs
- No hard-coded environment values
- Document public APIs with usage examples

---

## Part 3: Testing & Error Handling

### Testing Standards

- Test all public APIs and critical paths (target approximately 80% coverage)
- Use clear behavior-based test names
- Follow Arrange-Act-Assert pattern
- Include positive and negative cases

### Error Handling

- Fail fast with clear messages
- Never swallow exceptions
- Log with context (no secrets)
- Retry transient failures; use circuit breakers for dependencies

---

## Part 4: Security

- Validate and sanitize all user inputs
- Use parameterized queries (no SQL concatenation)
- Apply least-privilege principles
- Never commit secrets; rotate regularly
- Keep dependencies patched and scanned

---

## Part 5: Release & Operations

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

## Part 6: Collaboration

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

## Part 7: Technical Debt

- Mark debt with TODO or FIXME plus ticket number
- Review and prioritize quarterly
- Pay down high-interest debt first (security, performance)
- Allocate approximately 20% sprint capacity for debt reduction
- Record debt decisions in ADRs

---

## Part 8: Quick Reference

### Prompt Template

Use this template when requesting features:

```
Build [feature] that:
  - Uses clear naming
  - Validates inputs, handles errors
  - Includes tests for core cases
  - Follows [framework] conventions
  - Avoids premature abstraction
  - Keeps functions <30 lines
```

### Quality Checklist

- [ ] Understandable in 5 minutes
- [ ] Self-explanatory names
- [ ] Comprehensive error handling
- [ ] Simplicity favored over abstraction
- [ ] Tests and security checks included
- [ ] No hardcoded values or magic numbers
- [ ] All work committed before context exhaustion

### Red Flags

⚠ Functions exceeding 40 lines  
⚠ More than 3 nesting levels  
⚠ Unused abstractions or commented-out code  
⚠ TODOs without ticket links  
⚠ Copy-pasted logic (3+ times requires refactor)  
⚠ Hardcoded test values or magic numbers  
⚠ Trial-and-error fixes without root cause analysis  
⚠ Large uncommitted changes late in context

### Guiding Principle

> *Code should be safe to modify, easy to reason about, and boring to maintain. When in doubt, simplify.*

---

*Document Version 4.4 | Vinny Carpenter*
