import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSmartViews,
  getSmartView,
  getAppPreferences,
  updateAppPreferences,
} from '@/lib/smart-views';
import { getDb } from '@/lib/db';
import type { SmartView } from '@/lib/filters';
import { SCHEMA_LIMITS } from '@/lib/constants/schema';

/**
 * Custom smart-view creation and pinning are deliberately web-absent (retired
 * with the v9 shell; iOS is the surface that creates views), so tests seed the
 * `smartViews` table directly — the read path must keep serving views that
 * already exist in a user's database.
 */
function seedCustomView(overrides: Partial<SmartView> = {}): SmartView {
  return {
    id: 'custom-view-1',
    name: 'My Custom View',
    criteria: { tags: ['custom'] },
    isBuiltIn: false,
    createdAt: '2025-01-15T12:00:00.000Z',
    updatedAt: '2025-01-15T12:00:00.000Z',
    ...overrides,
  } as SmartView;
}

describe('Smart Views', () => {
  beforeEach(async () => {
    // Start each test from a clean slate: clear both custom views and the
    // preference state so app-preferences tests are isolated.
    const db = getDb();
    await db.smartViews.clear();
    await db.appPreferences.clear();
  });

  afterEach(async () => {
    await getDb().smartViews.clear();
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
      const customView = seedCustomView();
      await getDb().smartViews.add(customView);

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

    it('skips persisted views with malformed criteria instead of returning a crashable filter', async () => {
      const db = getDb();
      await db.smartViews.add({
        id: 'malformed-view',
        name: 'Malformed',
        criteria: { searchQuery: {} },
        isBuiltIn: false,
        createdAt: '2025-01-15T12:00:00.000Z',
        updatedAt: '2025-01-15T12:00:00.000Z',
      } as never);

      const views = await getSmartViews();

      expect(views.find((view) => view.id === 'malformed-view')).toBeUndefined();
    });

    it('skips a persisted view whose filter complexity exceeds the supported bounds', async () => {
      await getDb().smartViews.add(seedCustomView({
        id: 'oversized-filter',
        criteria: {
          tags: Array.from(
            { length: SCHEMA_LIMITS.MAX_SMART_VIEW_FILTER_TAGS + 1 },
            (_, index) => `tag-${index}`
          ),
        },
      }));

      const views = await getSmartViews();

      expect(views.find((view) => view.id === 'oversized-filter')).toBeUndefined();
    });

    // A view filters from the whole workspace tag vocabulary, which is unrelated
    // to how many tags one task may carry. Reusing the per-task cap made
    // previously valid views vanish from the UI with no message.
    it('renders a view filtering on more tags than a single task may carry', async () => {
      await getDb().smartViews.add(seedCustomView({
        id: 'many-tag-filter',
        criteria: {
          tags: Array.from({ length: SCHEMA_LIMITS.MAX_TAGS + 1 }, (_, index) => `tag-${index}`),
        },
      }));

      const views = await getSmartViews();

      expect(views.find((view) => view.id === 'many-tag-filter')).toBeDefined();
    });

    it('does not render any custom views when the persisted collection exceeds the aggregate cap', async () => {
      await getDb().smartViews.bulkAdd(
        Array.from({ length: SCHEMA_LIMITS.MAX_SMART_VIEWS + 1 }, (_, index) =>
          seedCustomView({ id: `custom-${index}`, name: `Custom ${index}` })
        )
      );

      const views = await getSmartViews();

      expect(views.every((view) => view.isBuiltIn)).toBe(true);
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
      const seeded = seedCustomView({ id: 'custom-view-2', name: 'Test View', criteria: { tags: ['test'] } });
      await getDb().smartViews.add(seeded);

      const retrieved = await getSmartView(seeded.id);

      expect(retrieved).toEqual(seeded);
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
        smartViewsEnabled: true,
      });

      const prefs = await getAppPreferences();
      expect(prefs.smartViewsEnabled).toBe(true);
    });
  });
});
