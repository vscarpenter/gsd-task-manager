/**
 * Tests for smart-views/built-in.ts
 */

import { describe, it, expect } from 'vitest';
import { BUILT_IN_SMART_VIEWS } from '@/lib/smart-views/built-in';

describe('BUILT_IN_SMART_VIEWS', () => {
  it('exports an array of smart views', () => {
    expect(Array.isArray(BUILT_IN_SMART_VIEWS)).toBe(true);
    expect(BUILT_IN_SMART_VIEWS.length).toBeGreaterThan(0);
  });

  it('each view has required properties', () => {
    for (const view of BUILT_IN_SMART_VIEWS) {
      expect(view).toHaveProperty('name');
      expect(view).toHaveProperty('icon');
      expect(view).toHaveProperty('criteria');
      expect(view).toHaveProperty('isBuiltIn', true);
      expect(typeof view.name).toBe('string');
      expect(typeof view.icon).toBe('string');
      expect(typeof view.criteria).toBe('object');
    }
  });

  it('includes Today\'s Focus view', () => {
    const todaysFocus = BUILT_IN_SMART_VIEWS.find(v => v.name === "Today's Focus");
    expect(todaysFocus).toBeDefined();
    expect(todaysFocus?.criteria.quadrants).toContain('urgent-important');
    expect(todaysFocus?.criteria.status).toBe('active');
  });

  it('includes This Week view', () => {
    const thisWeek = BUILT_IN_SMART_VIEWS.find(v => v.name === 'This Week');
    expect(thisWeek).toBeDefined();
    expect(thisWeek?.criteria.dueThisWeek).toBe(true);
    expect(thisWeek?.criteria.status).toBe('active');
  });

  it('includes Overdue Backlog view', () => {
    const overdue = BUILT_IN_SMART_VIEWS.find(v => v.name === 'Overdue Backlog');
    expect(overdue).toBeDefined();
    expect(overdue?.criteria.overdue).toBe(true);
    expect(overdue?.criteria.status).toBe('active');
  });

  it('includes No Deadline view', () => {
    const noDeadline = BUILT_IN_SMART_VIEWS.find(v => v.name === 'No Deadline');
    expect(noDeadline).toBeDefined();
    expect(noDeadline?.criteria.noDueDate).toBe(true);
    expect(noDeadline?.criteria.status).toBe('active');
  });

  it('includes Recently Added view', () => {
    const recentlyAdded = BUILT_IN_SMART_VIEWS.find(v => v.name === 'Recently Added');
    expect(recentlyAdded).toBeDefined();
    expect(recentlyAdded?.criteria.recentlyAdded).toBe(true);
    expect(recentlyAdded?.criteria.status).toBe('active');
  });

  it('includes This Week\'s Wins view (recently completed)', () => {
    const thisWeeksWins = BUILT_IN_SMART_VIEWS.find(v => v.name === "This Week's Wins");
    expect(thisWeeksWins).toBeDefined();
    expect(thisWeeksWins?.criteria.recentlyCompleted).toBe(true);
    expect(thisWeeksWins?.criteria.status).toBe('completed');
  });

  it('includes Recurring Tasks view', () => {
    const recurring = BUILT_IN_SMART_VIEWS.find(v => v.name === 'Recurring Tasks');
    expect(recurring).toBeDefined();
    expect(recurring?.criteria.recurrence).toEqual(['daily', 'weekly', 'monthly']);
    expect(recurring?.criteria.status).toBe('active');
  });

  it('all views have unique names', () => {
    const names = BUILT_IN_SMART_VIEWS.map(v => v.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

// Test that re-exports work correctly
describe('smart-views re-exports', () => {
  it('can import from lib/filters (backward compatibility)', async () => {
    const { BUILT_IN_SMART_VIEWS: fromFilters } = await import('@/lib/filters');
    expect(fromFilters).toEqual(BUILT_IN_SMART_VIEWS);
  });
});
