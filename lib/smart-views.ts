import { getDb } from "@/lib/db";
import { BUILT_IN_SMART_VIEWS, type SmartView } from "@/lib/filters";
import { smartViewSchema } from "@/lib/schema";
import type { AppPreferences } from "@/lib/types";
import { SMART_VIEWS_CONFIG } from "@/lib/constants";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";

export const APP_PREFERENCES_EVENT = "gsd:app-preferences";

export interface AppPreferencesEventDetail {
  preferences: AppPreferences;
}

const DEFAULT_APP_PREFERENCES: AppPreferences = {
  id: "preferences",
  pinnedSmartViewIds: [],
  maxPinnedViews: SMART_VIEWS_CONFIG.MAX_PINNED,
  smartViewsEnabled: false,
};

function parseStoredSmartView(view: unknown): SmartView | undefined {
  const parsed = smartViewSchema.safeParse(view);
  return parsed.success ? parsed.data as SmartView : undefined;
}

/**
 * Get all Smart Views (built-in + custom)
 */
export async function getSmartViews(): Promise<SmartView[]> {
  // Convert built-in views to full SmartView objects
  const builtInViews: SmartView[] = BUILT_IN_SMART_VIEWS.map(view => ({
    ...view,
    id: `built-in-${view.name.toLowerCase().replace(/\s+/g, '-')}`,
    createdAt: "2025-01-01T00:00:00.000Z", // Fixed date for built-ins
    updatedAt: "2025-01-01T00:00:00.000Z"
  }));

  const db = getDb();
  const storedViews = await db.smartViews
    .toCollection()
    .limit(SCHEMA_LIMITS.MAX_SMART_VIEWS + 1)
    .toArray();

  // A poisoned store must not be eagerly materialized or partially rendered.
  if (storedViews.length > SCHEMA_LIMITS.MAX_SMART_VIEWS) return builtInViews;

  const customViews = storedViews
    .map(parseStoredSmartView)
    .filter((view): view is SmartView => view !== undefined);

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
  const stored = await db.smartViews.get(id);
  return stored ? parseStoredSmartView(stored) : undefined;
}

/**
 * Get app preferences.
 *
 * Custom smart-view creation and pinning are deliberately web-absent (retired
 * with the v9 shell; iOS is the surface that creates views). The read path
 * above stays so existing custom views keep rendering, and the stored
 * `pinnedSmartViewIds` / `maxPinnedViews` fields stay in the schema for data
 * continuity — but nothing on the web writes or reads them anymore.
 */
export async function getAppPreferences(): Promise<AppPreferences> {
  const db = getDb();
  const prefs = await db.appPreferences.get("preferences");

  // Return defaults if not found (for initial load before migration runs)
  if (!prefs) {
    return DEFAULT_APP_PREFERENCES;
  }

  return {
    ...DEFAULT_APP_PREFERENCES,
    ...prefs,
    id: "preferences",
  };
}

/**
 * Update app preferences
 */
export async function updateAppPreferences(updates: Partial<Omit<AppPreferences, 'id'>>): Promise<AppPreferences> {
  const db = getDb();
  const existing = await getAppPreferences();

  const updated = {
    ...existing,
    ...updates
  };

  await db.appPreferences.put(updated);
  return updated;
}
