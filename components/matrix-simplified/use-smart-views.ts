/**
 * Smart-view state for the matrix: whether the feature is enabled, the loaded
 * views, the active view, and apply/clear actions. Extracted from
 * MatrixSimplified to keep the component focused.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TOAST_DURATION } from "@/lib/constants";
import { type SmartView } from "@/lib/filters";
import {
  APP_PREFERENCES_EVENT,
  getAppPreferences,
  getSmartView,
  getSmartViews,
  type AppPreferencesEventDetail,
} from "@/lib/smart-views";

export interface SmartViewsState {
  smartViewsEnabled: boolean;
  smartViews: SmartView[];
  activeSmartView: SmartView | null;
  applySmartViewById: (viewId: string) => Promise<void>;
  clearSmartView: () => void;
}

/**
 * @param clearSearch invoked when a smart view is applied, so applying a view
 *   also clears any active search (matching the matrix's existing behavior).
 */
export function useSmartViews(clearSearch: () => void): SmartViewsState {
  const [smartViewsEnabled, setSmartViewsEnabled] = useState(false);
  const [smartViews, setSmartViews] = useState<SmartView[]>([]);
  const [activeSmartView, setActiveSmartView] = useState<SmartView | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSmartViewPreference = async () => {
      const preferences = await getAppPreferences();
      if (!cancelled) {
        setSmartViewsEnabled(preferences.smartViewsEnabled);
      }
    };

    loadSmartViewPreference().catch(() => {
      if (!cancelled) {
        setSmartViewsEnabled(false);
      }
    });

    const onPreferencesChange = (event: Event) => {
      const preferences = (event as CustomEvent<AppPreferencesEventDetail>).detail?.preferences;
      if (!preferences) return;
      setSmartViewsEnabled(preferences.smartViewsEnabled);
      if (!preferences.smartViewsEnabled) {
        setActiveSmartView(null);
      }
    };

    window.addEventListener(APP_PREFERENCES_EVENT, onPreferencesChange);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_PREFERENCES_EVENT, onPreferencesChange);
    };
  }, []);

  useEffect(() => {
    if (!smartViewsEnabled) return;

    let cancelled = false;
    getSmartViews()
      .then((views) => {
        if (!cancelled) {
          setSmartViews(views);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSmartViews([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [smartViewsEnabled]);

  const applySmartViewById = async (viewId: string) => {
    const view = await getSmartView(viewId);
    if (!view) {
      toast.error("Smart view not found", { duration: TOAST_DURATION.SHORT });
      return;
    }
    clearSearch();
    setActiveSmartView(view);
  };

  const clearSmartView = () => {
    setActiveSmartView(null);
  };

  return { smartViewsEnabled, smartViews, activeSmartView, applySmartViewById, clearSmartView };
}
