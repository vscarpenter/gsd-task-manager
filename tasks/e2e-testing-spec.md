# E2E Testing Implementation Spec

## Goal
Implement comprehensive end-to-end tests using Playwright to validate core user workflows in the GSD Task Manager application, ensuring critical functionality works as expected across the entire application stack.

## Inputs
- Existing Next.js 16 application with client-side only rendering
- Current Vitest unit test setup
- Playwright available as MCP server
- Application runs on http://localhost:3000 in development

## Outputs
- Playwright configuration (`playwright.config.ts`)
- E2E test suite in `tests/e2e/` directory
- Test utilities and helpers for common actions
- Updated package.json with e2e test scripts
- Documentation for running and maintaining e2e tests

## Constraints
- Tests must run against local development server (http://localhost:3000)
- Tests should be fast and reliable (avoid flaky tests)
- Must handle IndexedDB cleanup between tests
- Should work in CI/CD pipeline
- Must follow existing code style and patterns
- Tests should be isolated and independent

## Edge Cases
- Application loading states and race conditions
- IndexedDB persistence between tests
- Network delays and slow rendering
- Browser differences (Chrome, Firefox, Safari)
- Responsive design (mobile vs desktop)
- PWA service worker caching
- Realtime sync events interfering with tests

## Out of Scope
- Cloud sync authentication and PocketBase integration (too complex for initial e2e)
- PWA offline functionality (can be added later)
- Performance/load testing
- Cross-browser compatibility beyond major browsers
- Visual regression testing
- Mobile-specific gestures (can be added later)

## Acceptance Criteria
1. Playwright is installed and configured with TypeScript support
2. Development server starts automatically before tests run
3. Tests can create, read, update, and delete tasks through the UI
4. Tests verify quadrant classification (urgent/important flags)
5. Tests verify matrix navigation and view switching
6. Tests verify search functionality including tags and subtasks
7. Tests verify smart views filtering
8. Tests verify settings page navigation
9. Tests clean up IndexedDB between test runs
10. All tests pass reliably across Chromium, Firefox, and WebKit
11. Package.json includes scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:debug`
12. Documentation explains how to run and debug e2e tests

## Test Stubs
```typescript
// tests/e2e/task-crud.spec.ts
test.describe('Task CRUD Operations', () => {
  test('should create a new task via capture bar', async () => {})
  test('should read and display task details', async () => {})
  test('should update task title and metadata', async () => {})
  test('should delete a task', async () => {})
  test('should handle task completion with confetti', async () => {})
})

// tests/e2e/quadrant-classification.spec.ts
test.describe('Quadrant Classification', () => {
  test('should classify task as urgent-important (Q1)', async () => {})
  test('should classify task as not-urgent-important (Q2)', async () => {})
  test('should classify task as urgent-not-important (Q3)', async () => {})
  test('should classify task as not-urgent-not-important (Q4)', async () => {})
  test('should move task between quadrants', async () => {})
})

// tests/e2e/matrix-navigation.spec.ts
test.describe('Matrix Navigation', () => {
  test('should display all four quadrants', async () => {})
  test('should navigate to dashboard view', async () => {})
  test('should navigate to archive view', async () => {})
  test('should navigate to settings page', async () => {})
  test('should return to matrix from other views', async () => {})
})

// tests/e2e/search.spec.ts
test.describe('Search Functionality', () => {
  test('should search tasks by title', async () => {})
  test('should search tasks by tags', async () => {})
  test('should search tasks by subtasks', async () => {})
  test('should clear search results', async () => {})
})

// tests/e2e/smart-views.spec.ts
test.describe('Smart Views', () => {
  test('should filter by today view', async () => {})
  test('should filter by upcoming view', async () => {})
  test('should filter by overdue view', async () => {})
  test('should create and use custom smart view', async () => {})
})

// tests/e2e/settings.spec.ts
test.describe('Settings Navigation', () => {
  test('should open settings page', async () => {})
  test('should navigate between settings sections', async () => {})
  test('should toggle appearance settings', async () => {})
  test('should export data', async () => {})
  test('should import data', async () => {})
})
```

## Implementation Notes
- Use Playwright's `@playwright/test` package
- Configure test timeout to 30s per test
- Use `baseURL` in config for consistent URLs
- Create page object model for common actions (login, navigation, task operations)
- Use test fixtures for setup/teardown
- Mock or disable realtime sync during tests to avoid interference
- Use `await expect(page).toHaveURL()` for navigation assertions
- Use `await page.waitForLoadState('networkidle')` for stability
- Implement proper IndexedDB cleanup in `beforeEach` and `afterEach`