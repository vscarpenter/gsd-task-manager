import { getDb } from "@/lib/db";
import { modifyRow } from "@/lib/db-row";
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

  return [...builtInViews, ...customViews];
}

export async function getSmartView(id: string): Promise<SmartView | undefined> {
  if (id.startsWith('built-in-')) {
    const allViews = await getSmartViews();
    return allViews.find(v => v.id === id);
  }

  const db = getDb();
  const stored = await db.smartViews.get(id);
  return stored ? parseStoredSmartView(stored) : undefined;
}

/** A row can be missing on the first load, before migrations seed it. */
function withDefaults(stored: AppPreferences | undefined): AppPreferences {
  return stored ? { ...DEFAULT_APP_PREFERENCES, ...stored, id: "preferences" } : DEFAULT_APP_PREFERENCES;
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
  return withDefaults(await db.appPreferences.get("preferences"));
}

/**
 * Update app preferences
 */
export async function updateAppPreferences(updates: Partial<Omit<AppPreferences, 'id'>>): Promise<AppPreferences> {
  return modifyRow(getDb().appPreferences, "preferences", (stored) => ({ ...withDefaults(stored), ...updates }));
}
