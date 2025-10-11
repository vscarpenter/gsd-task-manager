# Vinny’s Coding Standards (LLM-Optimized Edition)

## 🎯 Core Principles
- **Simplicity over cleverness.** Prefer clarity to novelty.  
- **Build small, iterate fast.** Deliver working code before optimizing.  
- **Code for humans.** Write as if the next developer is tired and in a hurry.  
- **Prefer boring tech.** Stability > hype.  
- **Automate consistency.** Enforce linting, tests, and formatting in CI.

---

## ✨ Code Quality

**Naming & Clarity**
- Use descriptive names, no `data`, `temp`, or single letters.  
- Functions ≤ 30 lines, single responsibility.  
- Max 3 levels of nesting; use early returns.  
- Comments explain *why*, not *what*.  
- Limit files to ~300 lines; split by responsibility.

**Structure & Abstraction**
- Apply **DRY** only after 3+ repetitions.  
- Follow **YAGNI** — don’t build for hypothetical futures.  
- Prefer **composition** over inheritance.  
- Duplicate if it’s clearer than abstracting.  
- No magic numbers; use named constants.  
- Inject dependencies (I/O, time, randomness).  

**Guardrails**
- Validate inputs, sanitize outputs.  
- No hard-coded environment values.  
- Document public APIs with usage examples.

---

## 🧪 Testing & Error Handling

**Testing**
- Test all public APIs and critical paths (≈80 % coverage).  
- Use clear behavior-based test names.  
- Follow *Arrange-Act-Assert* pattern.  
- Include positive and negative cases.  

**Error Handling**
- Fail fast with clear messages.  
- Never swallow exceptions.  
- Log with context (no secrets).  
- Retry transient failures; use circuit breakers for dependencies.

---

## 🔒 Security
- Validate and sanitize all user inputs.  
- Use parameterized queries (no SQL concatenation).  
- Apply least-privilege principles.  
- Never commit secrets; rotate regularly.  
- Keep dependencies patched and scanned.  

---

## 🚀 Release & Operations

**Deployment**
- Use **feature flags** (start OFF, roll out gradually).  
- Maintain **backward compatibility** with existing APIs/data.  
- Include **rollback scripts** for DB migrations.  
- Require passing CI/CD checks before merge.  
- Services must be **healthy before traffic**.

**Rollback & Monitoring**
- **15-minute rule:** Roll back if not fixed in 15 min.  
- Auto-rollback on >5 % error rate or 2× latency.  
- Structured JSON logs with correlation IDs.  
- Track the *Four Golden Signals* (latency, traffic, errors, saturation).  
- Add metrics for key business KPIs.  
- Document alert thresholds.

---

## 🤝 Collaboration

**Code Reviews**
- Keep PRs ≤ 400 lines.  
- Review for correctness first, style second.  
- Give constructive feedback with examples.  
- Respond within 1 business day.  
- Include context in PR descriptions.

**Documentation**
- README: setup + run instructions.  
- Inline comments for complex logic.  
- Architecture Decision Records (ADRs) for major choices.  
- Keep docs near code.  

**Version Control**
- Use **semantic versioning (MAJOR.MINOR.PATCH)**.  
- Clear, imperative commit messages (use *conventional commits* if possible).  
- Protect `main`/`master`.  
- Squash merges; tag releases consistently.

---

## ⚙️ Technical Debt
- Mark debt with `TODO` or `FIXME` + ticket number.  
- Review and prioritize quarterly.  
- Pay down **high-interest** debt first (security, perf).  
- Allocate ~20 % sprint capacity for debt reduction.  
- Record debt decisions in ADRs.

---

## 💡 Claude / Codex / LLM Integration

**Prompt Template**
```
Build [feature] that:
- Uses clear naming
- Validates inputs, handles errors
- Includes tests for core cases
- Follows [framework] conventions
- Avoids premature abstraction
- Keeps functions <30 lines
```

**Quality Checklist**
- [ ] Understandable in 5 min  
- [ ] Self-explanatory names  
- [ ] Comprehensive error handling  
- [ ] Simplicity favored over abstraction  
- [ ] Tests + security checks included  

**Red Flags**
- > 30 line functions  
- > 3 nesting levels  
- Unused abstractions or commented-out code  
- TODOs without ticket links  
- Copy-pasted logic (3+ times = refactor)

---

## 🧭 Guiding Principle
> *Code should be safe to modify, easy to reason about, and boring to maintain.*

When in doubt, **simplify.**
