# Test Fixtures and Utilities

This directory contains shared test fixtures, mock factories, and utility functions for the GSD Task Manager test suite.

## Purpose

The fixtures provide:
- **Consistent mock data** across all tests
- **Factory functions** for creating test data with sensible defaults
- **Utility functions** for common test operations (mocking, time manipulation, etc.)
- **Type-safe mocks** that match the application's data structures

## Usage

### Importing Fixtures

```typescript
import {
  createMockTask,
  createMockSyncConfig,
  mockDateNow,
  wait,
} from '@/tests/fixtures';
```

### Task Fixtures

```typescript
// Create a basic task
const task = createMockTask();

// Create a task with custom properties
const customTask = createMockTask({
  id: 'my-task-1',
  title: 'Custom Task',
  urgent: false,
  completed: true,
});

// Create multiple tasks
const tasks = createMockTasks(5); // Creates 5 tasks with sequential IDs

// Create multiple tasks with shared properties
const urgentTasks = createMockTasks(3, { urgent: true });

// Create a task draft (for form input)
const draft = createMockTaskDraft({
  title: 'New Task',
  urgent: true,
});

// Create a subtask
const subtask = createMockSubtask({
  title: 'My Subtask',
  completed: false,
});
```

### Sync Fixtures

```typescript
// Create sync configuration
const config = createMockSyncConfig({
  userId: 'user-123',
  email: 'me@example.com',
});

// Create sync history record
const historyRecord = createMockSyncHistoryRecord({
  status: 'success',
});

// Create sync queue item
const queueItem = createMockSyncQueueItem({
  operation: 'update',
  retryCount: 2,
});

// Create sync result
const result = createMockSyncResult({
  status: 'success',
  pushedCount: 5,
  pulledCount: 3,
});
```

### Health Monitor Fixtures

```typescript
// Create healthy report
const healthyReport = createMockHealthReport();

// Create report with issues
const unhealthyReport = createMockHealthReport({
  healthy: false,
  issues: [
    createMockHealthIssue({
      type: 'token_expired',
      severity: 'error',
    }),
  ],
});
```

### Notification Fixtures

```typescript
const settings = createMockNotificationSettings({
  enabled: true,
  defaultReminder: 30,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
});
```

### Mock API Responses

```typescript
// Mock successful fetch response
const response = createMockFetchResponse({ data: 'success' });

// Mock error response
const errorResponse = createMockErrorResponse(404, 'Not Found');

// Use with fetch mock
global.fetch = vi.fn(async () => response);
```

### Database Mocking

```typescript
// Create a mock Dexie table
const mockTable = createMockDexieTable<TaskRecord>();

// Use in tests
// lib/db.ts exports getDb(), so mock that function
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    tasks: mockTable,
  }),
}));

// Access internal data for assertions (after the code under test added three rows)
expect(mockTable._data).toHaveLength(3);
```

### Utility Functions

#### Time Manipulation

```typescript
// Wait for async operations
await wait(100); // Wait 100ms

// Create dates relative to now
const yesterday = createPastDate(1);
const tomorrow = createFutureDate(1);
const nextWeek = createRelativeDateISO(7);

// Mock Date.now()
const dateMock = mockDateNow(1234567890);
expect(Date.now()).toBe(1234567890);
dateMock.restore();
```

#### Console Mocking

```typescript
// Suppress console output during tests
const consoleMock = mockConsole();

// Your test code that logs to console
console.log('This will be mocked');

// Verify console calls before you restore
expect(console.log).toHaveBeenCalledWith('This will be mocked');

// Restore original console
consoleMock.restore();
```

#### Fetch Mocking

```typescript
// Mock fetch with a response
const fetchMock = mockFetch(createMockFetchResponse({ data: 'test' }));

// Or with a function
const fetchMock = mockFetch((url, init) => {
  if (url.includes('/api/sync')) {
    return createMockFetchResponse({ success: true });
  }
  return createMockErrorResponse(404, 'Not Found');
});

// Restore original fetch
fetchMock.restore();
```

#### Error Testing

```typescript
// Assert that a promise rejects
await expectToReject(
  someAsyncFunction(),
  'Expected error message'
);
```

## Best Practices

1. **Use fixtures for consistency**: Always use fixtures instead of creating mock data inline
2. **Override only what you need**: Start with defaults and override specific properties
3. **Keep tests isolated**: Use `beforeEach` to reset mocks and state
4. **Clean up after tests**: Restore mocked functions in `afterEach`
5. **Type safety**: Leverage TypeScript to ensure mocks match real types

## Example Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockTask, createMockSyncConfig, mockDateNow } from '@/tests/fixtures';

describe('fixtures', () => {
  let dateMock: ReturnType<typeof mockDateNow>;
  
  beforeEach(() => {
    // Mock current time
    dateMock = mockDateNow(1234567890);
  });
  
  afterEach(() => {
    // Restore time
    dateMock.restore();
  });
  
  it('should build a task and a sync config', () => {
    const task = createMockTask({ title: 'Test Task' });
    const config = createMockSyncConfig();
    
    expect(task.title).toBe('Test Task');
    expect(config.enabled).toBe(true);
    expect(Date.now()).toBe(1234567890);
  });
});
```

`example-usage.test.ts` in this directory holds more runnable examples.

## Data Fixtures

The directory also holds JSON data that several suites read:

- `cross-platform/`: backup exports and shared case corpora that pin behavior the web app shares with the native apps and the MCP server.
- `pinned-copies/`: values that two places each keep a copy of, mostly the app and the MCP server. Tests in `tests/data/pinned-copies/` read all of them, and tests in `packages/mcp-server/src/__tests__/pinned-copies/` read the ones the MCP server shares.
- `inkwell-token-contract.json`: the design token contract that `tests/data/inkwell-token-contract.test.ts` checks.

## Adding New Fixtures

When adding new fixtures:

1. Add the factory function to `index.ts`
2. Follow the naming convention: `createMock[Type]`
3. Provide sensible defaults
4. Support partial overrides via the last parameter
5. Add tests to `fixtures.test.ts`
6. Update this README with usage examples
