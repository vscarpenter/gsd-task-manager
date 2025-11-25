import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { BUILT_IN_SMART_VIEWS, type SmartView } from "@/lib/filters";
import type { AppPreferences } from "@/lib/types";
import { isoNow } from "@/lib/utils";

/**
 * Get all Smart Views (built-in + custom)
 */
export async function getSmartViews(): Promise<SmartView[]> {
  const db = getDb();
  const customViews = await db.smartViews.toArray();

  // Convert built-in views to full SmartView objects
  const builtInViews: SmartView[] = BUILT_IN_SMART_VIEWS.map(view => ({
    ...view,
    id: `built-in-${view.name.toLowerCase().replace(/\s+/g, '-')}`,
    createdAt: "2025-01-01T00:00:00.000Z", // Fixed date for built-ins
    updatedAt: "2025-01-01T00:00:00.000Z"
  }));

  // Return built-in views first, then custom views
  return [...builtInViews, ...customViews];
}

/**
 * Get a specific Smart View by ID
 */
export async function getSmartView(id: string): Promise<SmartView | undefined> {
  // Check if it's a built-in view
  if (id.startsWith('built-in-')) {
    const allViews = await getSmartViews();
    return allViews.find(v => v.id === id);
  }

  // Otherwise, fetch from database
  const db = getDb();
  return db.smartViews.get(id);
}

/**
 * Create a new custom Smart View
 */
export async function createSmartView(
  view: Omit<SmartView, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>
): Promise<SmartView> {
  const db = getDb();
  const now = isoNow();

  const newView: SmartView = {
    ...view,
    id: nanoid(12),
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now
  };

  await db.smartViews.add(newView);
  return newView;
}

/**
 * Update an existing custom Smart View
 */
export async function updateSmartView(
  id: string,
  updates: Partial<Omit<SmartView, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>>
): Promise<SmartView> {
  const db = getDb();
  const existing = await db.smartViews.get(id);

  if (!existing) {
    throw new Error(`Smart View ${id} not found`);
  }

  if (existing.isBuiltIn) {
    throw new Error("Cannot update built-in Smart Views");
  }

  const updated: SmartView = {
    ...existing,
    ...updates,
    updatedAt: isoNow()
  };

  await db.smartViews.put(updated);
  return updated;
}

/**
 * Delete a custom Smart View
 */
export async function deleteSmartView(id: string): Promise<void> {
  const db = getDb();
  const view = await db.smartViews.get(id);

  if (view?.isBuiltIn) {
    throw new Error("Cannot delete built-in Smart Views");
  }

  await db.smartViews.delete(id);
}

/**
 * Clear all custom Smart Views (built-ins are unaffected)
 */
export async function clearCustomSmartViews(): Promise<void> {
  const db = getDb();
  await db.smartViews.clear();
}

/**
 * Get app preferences (including pinned smart view IDs)
 */
export async function getAppPreferences() {
  const db = getDb();
  const prefs = await db.appPreferences.get("preferences");

  // Return defaults if not found (for initial load before migration runs)
  if (!prefs) {
    return {
      id: "preferences" as const,
      pinnedSmartViewIds: [],
      maxPinnedViews: 5
    };
  }

  return prefs;
}

/**
 * Update app preferences
 */
export async function updateAppPreferences(updates: Partial<Omit<AppPreferences, 'id'>>) {
  const db = getDb();
  const existing = await getAppPreferences();

  const updated = {
    ...existing,
    ...updates
  };

  await db.appPreferences.put(updated);
  return updated;
}

/**
 * Get pinned smart views in order
 */
export async function getPinnedSmartViews(): Promise<SmartView[]> {
  const prefs = await getAppPreferences();
  const allViews = await getSmartViews();

  // Return views in the order they appear in pinnedSmartViewIds
  return prefs.pinnedSmartViewIds
    .map(id => allViews.find(v => v.id === id))
    .filter((view): view is SmartView => view !== undefined);
}

/**
 * Pin a smart view to the header
 */
export async function pinSmartView(viewId: string): Promise<void> {
  const prefs = await getAppPreferences();

  // Check if already pinned
  if (prefs.pinnedSmartViewIds.includes(viewId)) {
    return; // Already pinned, nothing to do
  }

  // Check if we've reached the maximum
  if (prefs.pinnedSmartViewIds.length >= prefs.maxPinnedViews) {
    throw new Error(`Maximum ${prefs.maxPinnedViews} pinned views allowed`);
  }

  // Add to the end of the pinned list
  await updateAppPreferences({
    pinnedSmartViewIds: [...prefs.pinnedSmartViewIds, viewId]
  });
}

/**
 * Unpin a smart view from the header
 */
export async function unpinSmartView(viewId: string): Promise<void> {
  const prefs = await getAppPreferences();

  // Remove from pinned list
  await updateAppPreferences({
    pinnedSmartViewIds: prefs.pinnedSmartViewIds.filter(id => id !== viewId)
  });
}

/**
 * Check if a smart view is pinned
 */
export async function isSmartViewPinned(viewId: string): Promise<boolean> {
  const prefs = await getAppPreferences();
  return prefs.pinnedSmartViewIds.includes(viewId);
}

/**
 * Reorder pinned smart views
 */
export async function reorderPinnedViews(viewIds: string[]): Promise<void> {
  const prefs = await getAppPreferences();

  // Validate that all provided IDs are currently pinned
  const invalidIds = viewIds.filter(id => !prefs.pinnedSmartViewIds.includes(id));
  if (invalidIds.length > 0) {
    throw new Error(`Invalid view IDs in reorder: ${invalidIds.join(', ')}`);
  }

  // Update the order
  await updateAppPreferences({
    pinnedSmartViewIds: viewIds
  });
}
