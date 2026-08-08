import { describe, expect, it } from 'vitest';
import {
  formatDependencyError,
  getAffectedByDeletion,
  validateDependencies,
} from '../dependencies.js';
import type { Task } from '../types.js';

function task(id: string, dependencies: string[] = [], completed = false): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    urgent: false,
    important: false,
    quadrant: 'not-urgent-not-important',
    completed,
    tags: [],
    subtasks: [],
    recurrence: 'none',
    dependencies,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

describe('validateDependencies', () => {
  it('accepts existing incomplete dependencies for a new task', () => {
    expect(validateDependencies(null, ['a'], [task('a')])).toEqual({ valid: true });
  });

  it('rejects a self-reference', () => {
    expect(validateDependencies('a', ['a'], [task('a')])).toEqual({
      valid: false,
      error: 'A task cannot depend on itself',
    });
  });

  it('reports every missing dependency', () => {
    expect(validateDependencies('a', ['missing-1', 'missing-2'], [task('a')]).error)
      .toBe('Dependency tasks not found: missing-1, missing-2');
  });

  it('rejects completed dependencies by title', () => {
    expect(validateDependencies('a', ['done'], [task('a'), task('done', [], true)]).error)
      .toBe('Cannot depend on completed tasks: Task done');
  });

  it('detects direct and transitive cycles', () => {
    const direct = [task('a'), task('b', ['a'])];
    const transitive = [task('a'), task('b', ['c']), task('c', ['a'])];

    expect(validateDependencies('a', ['b'], direct).error)
      .toBe('Circular dependency detected with "Task b"');
    expect(validateDependencies('a', ['b'], transitive).valid).toBe(false);
  });

  it('terminates when the existing graph contains an unrelated cycle', () => {
    const tasks = [task('target'), task('a', ['b']), task('b', ['a'])];

    expect(validateDependencies('target', ['a'], tasks)).toEqual({ valid: true });
  });
});

describe('dependency deletion helpers', () => {
  it('returns only tasks that depend on the deleted task', () => {
    const dependent = task('dependent', ['source']);
    const unrelated = task('unrelated');

    expect(getAffectedByDeletion('source', [dependent, unrelated])).toEqual([dependent]);
  });

  it('formats a user-facing validation error', () => {
    expect(formatDependencyError('Cycle detected')).toContain('Cycle detected');
    expect(formatDependencyError('Cycle detected')).toContain('❌ Dependency validation failed');
  });
});
