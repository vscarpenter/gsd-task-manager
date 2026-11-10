import { describe, expect, it } from 'vitest';
import { generateInsightsSummary } from '../../analytics/aggregator.js';
import type { Task } from '../../types.js';

function task(id: string, quadrant: Task['quadrant'], completed = false): Task {
  return {
    id,
    title: `task ${id}`,
    description: '',
    urgent: quadrant.startsWith('urgent'),
    important: !quadrant.endsWith('not-important'),
    quadrant,
    completed,
    tags: [],
    subtasks: [],
    recurrence: 'none',
    dependencies: [],
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  };
}

describe('generateInsightsSummary', () => {
  it('names the quadrant with the most active tasks, not the best completion rate', () => {
    const doFirst = Array.from({ length: 10 }, (_, index) => task(`q1-${index}`, 'urgent-important'));
    const schedule = [task('q2-open', 'not-urgent-important'), task('q2-done', 'not-urgent-important', true)];

    const summary = generateInsightsSummary([...doFirst, ...schedule]);

    expect(summary).toContain('Most tasks in Q1: Do First: 10 active');
    expect(summary).not.toContain('Most tasks in Q2');
  });
});
