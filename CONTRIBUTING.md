# Contributing to GSD Task Manager

Thank you for your interest in contributing to GSD Task Manager! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community welcoming and respectful.

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Git
- A GitHub account

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/gsd-task-manager.git
   cd gsd-task-manager
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```
   The app will be available at http://localhost:3000

5. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Code Style

We follow strict code quality guidelines (see [CLAUDE.md](CLAUDE.md) for detailed philosophy):

- **Favor simplicity over cleverness** - Write readable code first
- **Use descriptive names** - Variables and functions should be self-explanatory
- **Keep functions small** - Each function should do one thing well
- **Add comments for "why," not "what"** - Code should be self-documenting

### Before Submitting

Run these commands to ensure your code meets quality standards:

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Tests
pnpm test

# Build verification
pnpm build
```

All checks must pass before submitting a PR.

### Testing

- Write tests for new features and bug fixes
- Place UI tests in `tests/ui/`, data logic in `tests/data/`
- Maintain ≥80% code coverage
- Run `pnpm test:watch` during development

### Commit Messages

Use clear, descriptive commit messages:

```
Add dark mode toggle to settings page

- Created theme toggle component
- Added theme context provider
- Updated styles for dark theme support
```

## Pull Request Process

1. **Update your branch** with the latest main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request** on GitHub with:
   - Clear title describing the change
   - Description of what changed and why
   - Screenshots for UI changes
   - Reference any related issues

4. **Respond to feedback** - A maintainer will review your PR and may request changes

5. **Merge** - Once approved and all checks pass, a maintainer will merge your PR

## Project Architecture

### Key Files and Directories

- `app/` - Next.js App Router pages and layouts
- `components/` - React components
- `lib/` - Core logic (database, tasks, utilities)
- `tests/` - Test files
- `public/` - Static assets and PWA files

### Data Layer

- **IndexedDB via Dexie** (`lib/db.ts`) - Local database
- **CRUD Operations** (`lib/tasks.ts`) - Task mutations
- **Live Queries** (`lib/use-tasks.ts`) - React hook for live data

### Quadrant System

Tasks use `urgent` and `important` boolean flags to determine quadrant:
- Q1: urgent + important (Do first)
- Q2: not urgent + important (Schedule)
- Q3: urgent + not important (Delegate)
- Q4: not urgent + not important (Eliminate)

See `lib/quadrants.ts` for implementation details.

## What to Contribute

### Good First Issues

Look for issues tagged `good first issue` - these are beginner-friendly tasks.

### Ideas for Contributions

- Bug fixes
- UI/UX improvements
- Accessibility enhancements
- Test coverage improvements
- Documentation updates
- Performance optimizations

### Not Accepting

- Features that require server-side logic (this is a privacy-first, client-only app)
- Features that send data to external services
- Major architectural changes without prior discussion

## Getting Help

- **Questions?** Open a discussion on GitHub
- **Bugs?** Open an issue with reproduction steps
- **Feature ideas?** Open an issue to discuss before implementing

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing to GSD Task Manager!
