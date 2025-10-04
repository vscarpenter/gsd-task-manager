# Code Development Guidelines

## Core Philosophy
- **Favor simplicity over cleverness** - Write code that's easy to understand first, optimize later if needed
- **Start minimal and iterate** - Build the smallest working solution, then enhance based on actual requirements
- **Optimize for the next developer** - Write code as if the person maintaining it is a violent psychopath who knows where you live

## Readability & Maintainability
- **Use descriptive names** - Variables, functions, and classes should clearly express their purpose
- **Keep functions small and focused** - Each function should do one thing well (single responsibility principle)
- **Minimize nesting** - Use early returns, guard clauses, and clear conditional logic
- **Add comments for "why," not "what"** - The code should be self-documenting for what it does
- **Follow consistent formatting** - Use team-agreed linting rules and code formatting standards

## DRY (Don't Repeat Yourself) - Applied Thoughtfully
- **Extract common patterns** but avoid premature abstraction
- **Create reusable functions/modules** when you see the same logic 3+ times
- **Use configuration over duplication** for environment-specific values
- **Balance DRY with readability** - sometimes a little duplication is clearer than complex abstraction

## Anti-Over-Engineering Principles
- **YAGNI (You Aren't Gonna Need It)** - Don't build features for hypothetical future requirements
- **Choose boring technology** - Use well-established patterns and libraries unless there's a compelling reason not to
- **Avoid premature optimization** - Make it work correctly first, then measure and optimize bottlenecks
- **Question every layer of abstraction** - Each abstraction should solve a real, current problem
- **Prefer composition over inheritance** - Build functionality by combining simple pieces

## Code Generation Instructions
When working with Claude Code, include these guidelines in your prompts:

### Essential Prompt Elements
- "Keep it simple and readable"
- "Use standard patterns and avoid clever tricks"
- "Include clear variable names and brief comments explaining complex logic"
- "Don't abstract until you see repeated patterns"
- "Focus on solving the immediate problem efficiently"

### Example Prompt Template
```
Generate [specific functionality] that:
- Uses clear, descriptive variable and function names
- Follows [language/framework] best practices
- Includes error handling where appropriate
- Has minimal complexity and nesting
- Includes brief comments for any non-obvious logic
- Avoids premature optimization
- Uses well-established libraries and patterns
```

## Quality Checklist
Before considering code complete, verify:
- [ ] Can a new team member understand this code in 5 minutes?
- [ ] Are variable and function names self-explanatory?
- [ ] Is the happy path clear and the error handling robust?
- [ ] Could this be simpler without losing functionality?
- [ ] Are there any "clever" parts that could be made more straightforward?
- [ ] Does it solve the actual problem without extra features?

## Red Flags to Watch For
- Functions longer than 20-30 lines
- More than 3 levels of nesting
- Variable names like `data`, `item`, `temp`, or single letters (except loop counters)
- Complex inheritance hierarchies
- Abstractions that are only used once
- Code that requires extensive comments to explain what it does (vs. why)

Remember: The goal is code that your team can quickly understand, modify, and extend without archaeological excavation of the original author's intent.
