import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSmartViews,
  getSmartView,
  createSmartView,
  updateSmartView,
  deleteSmartView,
  clearCustomSmartViews,
  getAppPreferences,
  updateAppPreferences,
  getPinnedSmartViews,
  pinSmartView,
  unpinSmartView,
} from '@/lib/smart-views';
import { getDb } from '@/lib/db';

// Mock nanoid to get predictable IDs
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-123'),
}));

// Mock isoNow for predictable timestamps
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils');
  return {
    ...actual,
    isoNow: vi.fn(() => '2025-01-15T12:00:00.000Z'),
  };
});

describe('Smart Views', () => {
  beforeEach(async () => {
    // Start each test from a clean slate: clear both custom views and the
    // pin/preference state so app-preferences tests are isolated.
    const db = getDb();
    await clearCustomSmartViews();
    await db.appPreferences.clear();
  });

  afterEach(async () => {
    await clearCustomSmartViews();
  });

  describe('getSmartViews', () => {
    it('should return built-in smart views', async () => {
      const views = await getSmartViews();

      expect(views.length).toBeGreaterThan(0);

      // Check for expected built-in views
      const builtInNames = views.filter(v => v.isBuiltIn).map(v => v.name);
      expect(builtInNames).toContain("Today's Focus");
      expect(builtInNames).toContain('This Week');
      expect(builtInNames).toContain('Overdue Backlog');
    });

    it('should include custom smart views after built-ins', async () => {
      const customView = await createSmartView({
        name: 'My Custom View',
        criteria: { tags: ['custom'] },
      });

      const views = await getSmartViews();

      // Custom views should appear after built-ins
      const customIndex = views.findIndex(v => v.id === customView.id);
      const firstBuiltInIndex = views.findIndex(v => v.isBuiltIn);

      expect(customIndex).toBeGreaterThan(firstBuiltInIndex);
    });

    it('should return only built-in views when no custom views exist', async () => {
      const views = await getSmartViews();

      expect(views.every(v => v.isBuiltIn)).toBe(true);
    });

    it('should return all built-in views with correct structure', async () => {
      const views = await getSmartViews();
      const builtInViews = views.filter(v => v.isBuiltIn);

      builtInViews.forEach(view => {
        expect(view).toMatchObject({
          id: expect.stringMatching(/^built-in-/),
          name: expect.any(String),
          criteria: expect.any(Object),
          isBuiltIn: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        });
      });
    });
  });

  describe('getSmartView', () => {
    it('should get built-in smart view by ID', async () => {
      const view = await getSmartView("built-in-today's-focus");

      expect(view).toBeDefined();
      expect(view?.name).toBe("Today's Focus");
      expect(view?.isBuiltIn).toBe(true);
    });

    it('should get custom smart view by ID', async () => {
      const created = await createSmartView({
        name: 'Test View',
        criteria: { tags: ['test'] },
      });

      const retrieved = await getSmartView(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent ID', async () => {
      const result = await getSmartView('non-existent-id');

      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent built-in ID', async () => {
      const result = await getSmartView('built-in-non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('createSmartView', () => {
    it('should create new custom smart view', async () => {
      const newView = await createSmartView({
        name: 'High Priority',
        criteria: { quadrants: ['urgent-important'] },
      });

      expect(newView).toMatchObject({
        id: 'test-id-123',
        name: 'High Priority',
        criteria: { quadrants: ['urgent-important'] },
        isBuiltIn: false,
        createdAt: '2025-01-15T12:00:00.000Z',
        updatedAt: '2025-01-15T12:00:00.000Z',
      });
    });

    it('should persist smart view to database', async () => {
      const created = await createSmartView({
        name: 'Persistent View',
        criteria: { tags: ['work'] },
      });

      const db = getDb();
      const retrieved = await db.smartViews.get(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should generate unique ID for each view', async () => {
      const mocked = await import('nanoid');
      let idCounter = 0;
      vi.mocked(mocked.nanoid).mockImplementation(() => `id-${idCounter++}`);

      const view1 = await createSmartView({ name: 'View 1', criteria: {} });
      const view2 = await createSmartView({ name: 'View 2', criteria: {} });

      expect(view1.id).not.toBe(view2.id);
    });

    it('should handle complex filter criteria', async () => {
      const newView = await createSmartView({
        name: 'Complex View',
        criteria: {
          quadrants: ['urgent-important', 'not-urgent-important'],
          status: 'active',
          tags: ['work', 'urgent'],
          dueDate: {
            mode: 'relative',
            days: 7,
          },
        },
      });

      expect(newView.criteria).toEqual({
        quadrants: ['urgent-important', 'not-urgent-important'],
        status: 'active',
        tags: ['work', 'urgent'],
        dueDate: {
          mode: 'relative',
          days: 7,
        },
      });
    });
  });

  describe('updateSmartView', () => {
    it('should update existing custom smart view', async () => {
      const created = await createSmartView({
        name: 'Original Name',
        criteria: { tags: ['old'] },
      });

      const utils = await import('@/lib/utils');
      vi.mocked(utils.isoNow).mockReturnValue('2025-01-15T13:00:00.000Z');

      const updated = await updateSmartView(created.id, {
        name: 'Updated Name',
        criteria: { tags: ['new'] },
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: 'Updated Name',
        criteria: { tags: ['new'] },
        createdAt: created.createdAt,
        updatedAt: '2025-01-15T13:00:00.000Z',
      });
    });

    it('should persist updates to database', async () => {
      const created = await createSmartView({
        name: 'Test',
        criteria: {},
      });

      await updateSmartView(created.id, { name: 'Updated' });

      const db = getDb();
      const retrieved = await db.smartViews.get(created.id);

      expect(retrieved?.name).toBe('Updated');
    });

    it('should throw error for non-existent view', async () => {
      await expect(
        updateSmartView('non-existent', { name: 'Updated' })
      ).rejects.toThrow('Smart View non-existent not found');
    });

    it('should throw error when updating built-in view', async () => {
      const db = getDb();

      // Add a fake built-in view to database (simulating data corruption)
      await db.smartViews.add({
        id: 'fake-built-in',
        name: 'Fake Built-in',
        criteria: {},
        isBuiltIn: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });

      await expect(
        updateSmartView('fake-built-in', { name: 'Hacked' })
      ).rejects.toThrow('Cannot update built-in Smart Views');
    });

    it('should allow partial updates', async () => {
      const created = await createSmartView({
        name: 'Original',
        criteria: { tags: ['tag1', 'tag2'] },
      });

      const updated = await updateSmartView(created.id, {
        name: 'New Name',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.criteria).toEqual({ tags: ['tag1', 'tag2'] });
    });
  });

  describe('deleteSmartView', () => {
    it('should delete custom smart view', async () => {
      const created = await createSmartView({
        name: 'To Delete',
        criteria: {},
      });

      await deleteSmartView(created.id);

      const db = getDb();
      const retrieved = await db.smartViews.get(created.id);

      expect(retrieved).toBeUndefined();
    });

    it('should throw error when deleting built-in view', async () => {
      const db = getDb();

      // Add a fake built-in view
      await db.smartViews.add({
        id: 'fake-built-in',
        name: 'Fake Built-in',
        criteria: {},
        isBuiltIn: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      });

      await expect(
        deleteSmartView('fake-built-in')
      ).rejects.toThrow('Cannot delete built-in Smart Views');
    });

    it('should not throw error for non-existent view', async () => {
      await expect(deleteSmartView('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clearCustomSmartViews', () => {
    it('should clear all custom smart views', async () => {
      await createSmartView({ name: 'View 1', criteria: {} });
      await createSmartView({ name: 'View 2', criteria: {} });
      await createSmartView({ name: 'View 3', criteria: {} });

      await clearCustomSmartViews();

      const db = getDb();
      const remaining = await db.smartViews.toArray();

      expect(remaining).toHaveLength(0);
    });

    it('should not affect built-in views (they are not in db)', async () => {
      await createSmartView({ name: 'Custom', criteria: {} });

      const viewsBeforeClear = await getSmartViews();
      const builtInCount = viewsBeforeClear.filter(v => v.isBuiltIn).length;

      await clearCustomSmartViews();

      const viewsAfterClear = await getSmartViews();
      const builtInCountAfter = viewsAfterClear.filter(v => v.isBuiltIn).length;

      expect(builtInCount).toBe(builtInCountAfter);
      expect(viewsAfterClear.every(v => v.isBuiltIn)).toBe(true);
    });

    it('should work when no custom views exist', async () => {
      await expect(clearCustomSmartViews()).resolves.not.toThrow();
    });
  });

  // Migrated from the former tests/data/coverage-boost.test.ts "smart-views"
  // block (finding F2.1). The CRUD cases there duplicated the suites above and
  // were dropped; these app-preferences / pinning cases were the block's unique
  // coverage of lib/smart-views.ts and are preserved here, rewritten against the
  // real `criteria` API with deterministic (no conditional) assertions.
  describe('app preferences', () => {
    it('should return default preferences when none are stored', async () => {
      const prefs = await getAppPreferences();

      expect(prefs.id).toBe('preferences');
      expect(prefs.pinnedSmartViewIds).toEqual([]);
      expect(prefs.maxPinnedViews).toBe(5);
      expect(prefs.smartViewsEnabled).toBe(false);
    });

    it('should persist updated preferences', async () => {
      await updateAppPreferences({
        pinnedSmartViewIds: ['view-1', 'view-2'],
        smartViewsEnabled: true,
      });

      const prefs = await getAppPreferences();
      expect(prefs.pinnedSmartViewIds).toEqual(['view-1', 'view-2']);
      expect(prefs.smartViewsEnabled).toBe(true);
    });
  });

  describe('pinning', () => {
    it('should pin a smart view', async () => {
      await pinSmartView('view-1');

      const prefs = await getAppPreferences();
      expect(prefs.pinnedSmartViewIds).toContain('view-1');
    });

    it('should be a no-op when pinning an already-pinned view', async () => {
      await updateAppPreferences({ pinnedSmartViewIds: ['view-1'] });
      await pinSmartView('view-1');

      const prefs = await getAppPreferences();
      expect(prefs.pinnedSmartViewIds).toEqual(['view-1']);
    });

    it('should throw when the maximum number of pinned views is reached', async () => {
      await updateAppPreferences({
        pinnedSmartViewIds: ['v1', 'v2', 'v3', 'v4', 'v5'],
        maxPinnedViews: 5,
      });

      await expect(pinSmartView('v6')).rejects.toThrow(/Maximum/);
    });

    it('should unpin a smart view', async () => {
      await updateAppPreferences({ pinnedSmartViewIds: ['v1', 'v2'] });
      await unpinSmartView('v1');

      const prefs = await getAppPreferences();
      expect(prefs.pinnedSmartViewIds).toEqual(['v2']);
    });

    it('should resolve pinned views in the stored order', async () => {
      const allViews = await getSmartViews();
      const [first, second] = allViews;

      await updateAppPreferences({ pinnedSmartViewIds: [second.id, first.id] });

      const pinned = await getPinnedSmartViews();
      expect(pinned.map(v => v.id)).toEqual([second.id, first.id]);
    });

    it('should skip pinned IDs that no longer resolve to a view', async () => {
      const allViews = await getSmartViews();
      const real = allViews[0];

      await updateAppPreferences({
        pinnedSmartViewIds: ['deleted-or-unknown', real.id],
      });

      const pinned = await getPinnedSmartViews();
      expect(pinned.map(v => v.id)).toEqual([real.id]);
    });
  });
});
