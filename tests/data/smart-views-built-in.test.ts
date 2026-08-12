/**
 * Tests for smart-views/built-in.ts
 */

import { describe, it, expect } from 'vitest';
import { BUILT_IN_SMART_VIEWS } from '@/lib/smart-views/built-in';
import { SMART_VIEW_ICONS } from '@/lib/smart-views/icons';

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

  // Withheld until the edit drawer can set `recurrence`. The recurrence engine
  // works (toggle.ts spawns the next instance on completion), but nothing in the
  // UI can turn it on, so this view can only ever be empty for a UI-only user.
  // Restore it with the recurrence authoring UI.
  it('omits the Recurring Tasks view while recurrence has no authoring UI', () => {
    const recurring = BUILT_IN_SMART_VIEWS.find(v => v.name === 'Recurring Tasks');
    expect(recurring).toBeUndefined();
  });

  it('all views have unique names', () => {
    const names = BUILT_IN_SMART_VIEWS.map(v => v.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  // PRODUCT.md anti-reference: "a gamified todo toy". Emoji as feature icons is
  // the loudest tell; the rest of the app draws its chrome with the Lucide set.
  // `icon` stays a string (custom user views may still carry one) but built-ins
  // name a Lucide glyph instead of embedding a pictograph.
  it('no built-in view uses an emoji icon', () => {
    for (const view of BUILT_IN_SMART_VIEWS) {
      expect(view.icon).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('every built-in icon resolves to a known Lucide glyph', () => {
    for (const view of BUILT_IN_SMART_VIEWS) {
      expect(SMART_VIEW_ICONS).toHaveProperty(view.icon as string);
    }
  });

  // "start now!" — PRODUCT.md voice: no exclamation-point cheerleading.
  it('no built-in description uses exclamation-point cheerleading', () => {
    for (const view of BUILT_IN_SMART_VIEWS) {
      expect(view.description ?? '').not.toContain('!');
    }
  });
});

// Test that re-exports work correctly
describe('smart-views re-exports', () => {
  it('can import from lib/filters (backward compatibility)', async () => {
    const { BUILT_IN_SMART_VIEWS: fromFilters } = await import('@/lib/filters');
    expect(fromFilters).toEqual(BUILT_IN_SMART_VIEWS);
  });
});
