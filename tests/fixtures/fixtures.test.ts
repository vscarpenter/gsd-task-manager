/**
 * Tests for test fixtures to ensure they work correctly
 */

import { describe, it, expect } from 'vitest';
import {
  createMockTask,
  createMockTaskDraft,
  createMockSubtask,
  createMockTasks,
  createMockSyncConfig,
  createMockVectorClock,
  createMockSyncQueueItem,
  createMockHealthReport,
  createMockNotificationSettings,
  createMockSyncHistoryRecord,
  createMockFetchResponse,
  createMockErrorResponse,
  createPastDate,
  createFutureDate,
  createRelativeDateISO,
} from './index';

describe('Task Fixtures', () => {
  it('should create a mock task with default values', () => {
    const task = createMockTask();
    
    expect(task.id).toBe('test-task-1');
    expect(task.title).toBe('Test Task');
    expect(task.urgent).toBe(true);
    expect(task.important).toBe(true);
    expect(task.quadrant).toBe('urgent-important');
    expect(task.completed).toBe(false);
    expect(task.recurrence).toBe('none');
    expect(task.tags).toEqual([]);
    expect(task.subtasks).toEqual([]);
  });

  it('should create a mock task with overrides', () => {
    const task = createMockTask({
      id: 'custom-id',
      title: 'Custom Title',
      urgent: false,
      completed: true,
    });
    
    expect(task.id).toBe('custom-id');
    expect(task.title).toBe('Custom Title');
    expect(task.urgent).toBe(false);
    expect(task.completed).toBe(true);
  });

  it('should create a mock task draft', () => {
    const draft = createMockTaskDraft();
    
    expect(draft.title).toBe('Test Task');
    expect(draft.urgent).toBe(true);
    expect(draft.important).toBe(true);
  });

  it('should create a mock subtask', () => {
    const subtask = createMockSubtask();
    
    expect(subtask.id).toBe('subtask-1');
    expect(subtask.title).toBe('Test Subtask');
    expect(subtask.completed).toBe(false);
  });

  it('should create multiple mock tasks', () => {
    const tasks = createMockTasks(3);
    
    expect(tasks).toHaveLength(3);
    expect(tasks[0].id).toBe('test-task-1');
    expect(tasks[1].id).toBe('test-task-2');
    expect(tasks[2].id).toBe('test-task-3');
  });

  it('should create multiple mock tasks with base overrides', () => {
    const tasks = createMockTasks(2, { urgent: false });
    
    expect(tasks).toHaveLength(2);
    expect(tasks[0].urgent).toBe(false);
    expect(tasks[1].urgent).toBe(false);
  });
});

describe('Sync Fixtures', () => {
  it('should create a mock sync config', () => {
    const config = createMockSyncConfig();
    
    expect(config.key).toBe('sync_config');
    expect(config.enabled).toBe(true);
    expect(config.userId).toBe('user-123');
    expect(config.deviceId).toBe('device-456');
    expect(config.email).toBe('test@example.com');
    expect(config.token).toBe('test-token-abc123');
  });

  it('should create a mock vector clock', () => {
    const clock = createMockVectorClock();
    
    expect(clock['device-456']).toBe(1);
  });

  it('should create a mock sync queue item', () => {
    const item = createMockSyncQueueItem();
    
    expect(item.id).toBe('queue-item-1');
    expect(item.taskId).toBe('test-task-1');
    expect(item.operation).toBe('create');
    expect(item.retryCount).toBe(0);
  });
});

describe('Health Monitor Fixtures', () => {
  it('should create a mock health report', () => {
    const report = createMockHealthReport();
    
    expect(report.healthy).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.timestamp).toBeDefined();
  });

  it('should create a mock health report with issues', () => {
    const report = createMockHealthReport({
      healthy: false,
      issues: [{
        type: 'token_expired',
        severity: 'error',
        message: 'Token expired',
        suggestedAction: 'Sign in again',
      }],
    });
    
    expect(report.healthy).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].type).toBe('token_expired');
  });
});

describe('Notification Fixtures', () => {
  it('should create mock notification settings', () => {
    const settings = createMockNotificationSettings();
    
    expect(settings.id).toBe('settings');
    expect(settings.enabled).toBe(true);
    expect(settings.defaultReminder).toBe(15);
    expect(settings.soundEnabled).toBe(true);
  });
});

describe('Sync History Fixtures', () => {
  it('should create a mock sync history record', () => {
    const record = createMockSyncHistoryRecord();
    
    expect(record.id).toBe('sync-history-1');
    expect(record.status).toBe('success');
    expect(record.deviceId).toBe('device-456');
    expect(record.triggeredBy).toBe('user');
  });
});

describe('Mock API Response Factories', () => {
  it('should create a mock fetch response', async () => {
    const response = createMockFetchResponse({ data: 'test' });
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    const json = await response.json();
    expect(json).toEqual({ data: 'test' });
  });

  it('should create a mock error response', async () => {
    const response = createMockErrorResponse(404, 'Not Found');
    
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
    
    const json = await response.json();
    expect(json).toEqual({ error: 'Not Found' });
  });
});

describe('Date Utility Functions', () => {
  it('should create a past date', () => {
    const pastDate = createPastDate(5);
    const now = new Date();
    
    expect(pastDate.getTime()).toBeLessThan(now.getTime());
  });

  it('should create a future date', () => {
    const futureDate = createFutureDate(5);
    const now = new Date();
    
    expect(futureDate.getTime()).toBeGreaterThan(now.getTime());
  });

  it('should create a relative date ISO string', () => {
    const isoString = createRelativeDateISO(1);
    
    expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
