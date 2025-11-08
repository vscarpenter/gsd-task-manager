/**
 * Example test demonstrating fixture usage
 * This file shows best practices for using the test fixtures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockTask,
  createMockTasks,
  createMockSyncConfig,
  createMockHealthReport,
  createMockFetchResponse,
  mockDateNow,
  mockConsole,
  wait,
  createPastDate,
  createFutureDate,
} from './index';

describe('Example: Using Task Fixtures', () => {
  it('should create a task with default values', () => {
    const task = createMockTask();
    
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test Task');
    expect(task.completed).toBe(false);
  });

  it('should create a task with custom properties', () => {
    const task = createMockTask({
      title: 'My Custom Task',
      urgent: false,
      tags: ['work', 'important'],
    });
    
    expect(task.title).toBe('My Custom Task');
    expect(task.urgent).toBe(false);
    expect(task.tags).toEqual(['work', 'important']);
  });

  it('should create multiple tasks', () => {
    const tasks = createMockTasks(5);
    
    expect(tasks).toHaveLength(5);
    expect(tasks[0].id).toBe('test-task-1');
    expect(tasks[4].id).toBe('test-task-5');
  });

  it('should create tasks with overdue dates', () => {
    const yesterday = createPastDate(1);
    const task = createMockTask({
      dueDate: yesterday.toISOString(),
    });
    
    expect(new Date(task.dueDate!).getTime()).toBeLessThan(Date.now());
  });

  it('should create tasks with future dates', () => {
    const tomorrow = createFutureDate(1);
    const task = createMockTask({
      dueDate: tomorrow.toISOString(),
    });
    
    expect(new Date(task.dueDate!).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('Example: Using Sync Fixtures', () => {
  it('should create sync configuration', () => {
    const config = createMockSyncConfig({
      userId: 'user-abc',
      email: 'user@example.com',
    });
    
    expect(config.userId).toBe('user-abc');
    expect(config.email).toBe('user@example.com');
    expect(config.enabled).toBe(true);
  });

  it('should create health report', () => {
    const report = createMockHealthReport({
      healthy: false,
      issues: [{
        type: 'token_expired',
        severity: 'error',
        message: 'Token has expired',
        suggestedAction: 'Sign in again',
      }],
    });
    
    expect(report.healthy).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].type).toBe('token_expired');
  });
});

describe('Example: Mocking Time', () => {
  let dateMock: ReturnType<typeof mockDateNow>;
  
  beforeEach(() => {
    // Set a fixed timestamp for consistent testing
    dateMock = mockDateNow(1609459200000); // 2021-01-01 00:00:00 UTC
  });
  
  afterEach(() => {
    dateMock.restore();
  });
  
  it('should use mocked time', () => {
    expect(Date.now()).toBe(1609459200000);
    
    // When using mocked time, you can verify time-based logic
    const timestamp = Date.now();
    expect(timestamp).toBe(1609459200000);
  });
});

describe('Example: Mocking Console', () => {
  let consoleMock: ReturnType<typeof mockConsole>;
  
  beforeEach(() => {
    consoleMock = mockConsole();
  });
  
  afterEach(() => {
    consoleMock.restore();
  });
  
  it('should suppress console output', () => {
    console.log('This will not appear in test output');
    console.error('Neither will this');
    
    expect(console.log).toHaveBeenCalledWith('This will not appear in test output');
    expect(console.error).toHaveBeenCalledWith('Neither will this');
  });
});

describe('Example: Mocking Fetch', () => {
  beforeEach(() => {
    // Mock fetch globally
    global.fetch = vi.fn();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should mock successful API response', async () => {
    const mockResponse = createMockFetchResponse({
      success: true,
      data: { id: '123' },
    });
    
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);
    
    const response = await fetch('/api/test');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('123');
  });

  it('should mock API error response', async () => {
    const mockResponse = createMockFetchResponse(
      { error: 'Not found' },
      { ok: false, status: 404 }
    );
    
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);
    
    const response = await fetch('/api/test');
    
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });
});

describe('Example: Async Testing', () => {
  it('should wait for async operations', async () => {
    let completed = false;
    
    setTimeout(() => {
      completed = true;
    }, 50);
    
    expect(completed).toBe(false);
    
    await wait(100);
    
    expect(completed).toBe(true);
  });
});

describe('Example: Complex Test Scenario', () => {
  let dateMock: ReturnType<typeof mockDateNow>;
  let consoleMock: ReturnType<typeof mockConsole>;
  
  beforeEach(() => {
    dateMock = mockDateNow(1609459200000);
    consoleMock = mockConsole();
    global.fetch = vi.fn();
  });
  
  afterEach(() => {
    dateMock.restore();
    consoleMock.restore();
    vi.restoreAllMocks();
  });
  
  it('should handle a complete sync scenario', async () => {
    // Create test data
    const tasks = createMockTasks(3, { completed: false });
    const config = createMockSyncConfig();
    
    // Mock API response
    const mockResponse = createMockFetchResponse({
      success: true,
      synced: tasks.length,
    });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);
    
    // Simulate sync operation
    console.log('Starting sync...');
    const response = await fetch(`${config.serverUrl}/sync`);
    const result = await response.json();
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.synced).toBe(3);
    expect(console.log).toHaveBeenCalledWith('Starting sync...');
  });
});
