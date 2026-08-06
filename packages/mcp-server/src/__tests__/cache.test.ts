import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateTaskListCacheKey,
  getTaskCache,
  resetTaskCache,
} from '../cache.js';
import type { Task } from '../types.js';

function task(id: string): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed: false,
    tags: [],
    subtasks: [],
    recurrence: 'none',
    dependencies: [],
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

describe('task cache', () => {
  beforeEach(() => {
    resetTaskCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T00:00:00.000Z'));
  });

  afterEach(() => {
    resetTaskCache();
    vi.useRealTimers();
  });

  it('returns one singleton until reset', () => {
    const first = getTaskCache({ ttlMs: 1000, maxEntries: 2 });

    expect(getTaskCache()).toBe(first);
    resetTaskCache();
    expect(getTaskCache()).not.toBe(first);
  });

  it('tracks list and single-task hits and misses', () => {
    const cache = getTaskCache({ ttlMs: 1000, maxEntries: 5 });
    const tasks = [task('one'), task('two')];

    expect(cache.getTaskList('all')).toBeNull();
    cache.setTaskList('all', tasks);
    expect(cache.getTaskList('all')).toEqual(tasks);
    expect(cache.getTask('one')).toEqual(tasks[0]);
    expect(cache.getTask('missing')).toBeNull();
    expect(cache.getStats()).toMatchObject({ hits: 2, misses: 2, hitRate: 0.5 });
  });

  it('expires entries after the configured TTL', () => {
    const cache = getTaskCache({ ttlMs: 100, maxEntries: 5 });
    cache.setTask(task('expiring'));
    vi.advanceTimersByTime(101);

    expect(cache.getTask('expiring')).toBeNull();
    expect(cache.getStats().singleTaskCache.size).toBe(0);
  });

  it('evicts the oldest entry when capacity is reached', () => {
    const cache = getTaskCache({ ttlMs: 1000, maxEntries: 1 });
    cache.setTask(task('oldest'));
    cache.setTask(task('newest'));

    expect(cache.getTask('oldest')).toBeNull();
    expect(cache.getTask('newest')?.id).toBe('newest');
  });

  it('invalidates one task and every cached list', () => {
    const cache = getTaskCache({ ttlMs: 1000, maxEntries: 5 });
    cache.setTaskList('all', [task('one'), task('two')]);
    cache.invalidateTask('one');

    expect(cache.getTask('one')).toBeNull();
    expect(cache.getTask('two')?.id).toBe('two');
    expect(cache.getTaskList('all')).toBeNull();
  });

  it('clears entries and resets statistics', () => {
    const cache = getTaskCache({ ttlMs: 1000, maxEntries: 5 });
    cache.setTaskList('all', [task('one')]);
    cache.getTaskList('all');
    cache.invalidate();
    cache.resetStats();

    expect(cache.getStats()).toMatchObject({ hits: 0, misses: 0, hitRate: 0 });
    expect(cache.getStats().taskListCache.size).toBe(0);
    expect(cache.getStats().singleTaskCache.size).toBe(0);
  });
});

describe('generateTaskListCacheKey', () => {
  it('uses all for absent or empty filters', () => {
    expect(generateTaskListCacheKey()).toBe('all');
    expect(generateTaskListCacheKey({})).toBe('all');
  });

  it('includes false completion and stable sorted tags', () => {
    expect(generateTaskListCacheKey({
      quadrant: 'urgent-important',
      completed: false,
      tags: ['work', 'alpha'],
    })).toBe('q:urgent-important|c:false|t:alpha,work');
  });
});
