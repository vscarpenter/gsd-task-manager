# Code Standards & Agentic Guidance

*Comprehensive guidance for AI-assisted development*

---

## Part 1: Agentic Behavior Guidelines

These directives govern how LLMs approach complex, multi-step tasks requiring sustained autonomous work. Every directive in this section is actionable and applies to every coding session.

### Context Management & Sustained Work

For lengthy tasks, YOU MUST follow these requirements:

1. Before writing code, outline your implementation plan with clear milestones.
2. Work systematically through each milestone, committing functional changes frequently.
3. Commit at least every significant component or logical unit of work.
4. Monitor your context usage and prioritize committing working code before context exhaustion.
5. Never leave significant work uncommitted.

> **Critical:** If you find yourself 80% through context with major uncommitted work, stop adding features and commit immediately.

**Compaction Directive:** When compacting, always preserve the full list of modified files, current task status, test commands, and next steps. Do not discard working state during summarization.

### Reflection After Tool Results

After each tool result, pause to evaluate before proceeding:

- Did the operation succeed or fail?
- Does the output match expectations?
- Are there edge cases or errors to address?
- What is the root cause if results are unexpected?

Use extended thinking to analyze results and plan your next action. If results are unexpected, diagnose the root cause before attempting fixes. Avoid repeated trial-and-error changes without understanding the underlying issue.

### Solution Quality Requirements

Every solution YOU MUST meet these standards:

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
- Run the full test suite after every file modification and fix failures before proceeding
- Do not assume code is correct without execution
- If tests fail, analyze the failure and diagnose root cause before making changes

### Progress Updates

After completing each milestone or significant tool operation, provide a brief summary of what was done, what changed, and what comes next. Do not skip status updates after tool calls.

### Error Learning

After encountering a mistake or suboptimal solution, analyze what went wrong and propose a specific CLAUDE.md update to prevent recurrence. Actively improve the development process.

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
- Limit code files to approximately 350-400 lines; split by responsibility

### Structure & Abstraction

- Apply DRY only after 3+ repetitions
- Follow YAGNI: do not build for hypothetical futures
- Prefer composition over inheritance
- Duplicate if it is clearer than abstracting
- No magic numbers; use named constants
- Inject dependencies (I/O, time, randomness)

### File Boundaries

- Do not modify files outside the current working directory without explicit permission
- Do not edit configuration files, CI/CD pipelines, or infrastructure code unless the task specifically requires it
- When uncertain about scope, ask before modifying files in shared or upstream directories

### Guardrails

- Validate inputs, sanitize outputs
- No hard-coded environment values
- Document public APIs with usage examples

### Subagents

- Use subagents liberally to keep main context window clean and focused
- Offload research, exploration, file analysis, and codebase scanning to subagents
- For complex problems, use parallel subagents for independent analysis tasks
- Chain subagents sequentially when tasks have dependencies (plan > implement > test)
- One well-defined task per subagent for focused execution
- Subagents MUST return concise summaries, not raw output, to preserve main context
- Use read-only tools (Read, Grep, Glob) for research subagents; grant write access only to implementation subagents
- Prefer Haiku-model subagents for simple research, scanning, and exploration tasks to control costs
- Reserve Sonnet or Opus for subagents that reason about architecture or write complex implementations
- During implementation, delegate tasks to available subagents based on their expertise:
  - Use Explore subagent for codebase scanning, pattern discovery, and reading files
  - Use general-purpose subagent for multi-step implementation tasks requiring file modifications
  - Use dedicated review subagents for code quality, security, and test coverage checks

---

## Part 3: Testing & Error Handling

### Testing Standards

- Write tests BEFORE implementation when feasible (TDD approach)
- Test all public APIs and critical paths (target approximately 80% coverage)
- Use clear behavior-based test names
- Follow Arrange-Act-Assert pattern
- Include positive and negative cases
- Run the full test suite after every modification; do not proceed with failing tests

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

## Part 5: Quick Reference

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

### Verification Shortcuts

When I type **"qcheck"**, perform this analysis:

```
You are a SKEPTICAL senior software engineer. For every MAJOR code change:
1. Does this follow our coding standards?
2. Are there comprehensive tests?
3. Is error handling adequate?
4. Does this maintain existing patterns?
5. Are there any security concerns?
6. Is the code maintainable and readable?
```

When I type **"qcode"**, do this:

```
Implement your plan and ensure:
- All new tests pass
- Run existing tests to ensure nothing breaks
- Run linting/formatting tools
- Verify type checking passes
- Code follows established patterns
```

### Quality Checklist

- [ ] Understandable in 5 minutes
- [ ] Self-explanatory names
- [ ] Comprehensive error handling
- [ ] Simplicity favored over abstraction
- [ ] Tests and security checks included
- [ ] No hardcoded values or magic numbers
- [ ] All work committed before context exhaustion
- [ ] Test suite passes after every modification

### Red Flags

- Functions exceeding 40 lines
- More than 3 nesting levels
- Unused abstractions or commented-out code
- TODOs without ticket links
- Copy-pasted logic (3+ times requires refactor)
- Hardcoded test values or magic numbers
- Trial-and-error fixes without root cause analysis
- Large uncommitted changes late in context
- Modifying files outside the task's scope

### Guiding Principle

> *Code should be safe to modify, easy to reason about, and boring to maintain. When in doubt, simplify.*

---

*Document Version 5.0 | Vinny Carpenter*
