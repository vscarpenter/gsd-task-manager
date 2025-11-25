import { useEffect } from "react";
import type { SmartView, FilterCriteria } from "@/lib/filters";

/**
 * Check if the event target is an element where typing is expected
 */
function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return true;
  }
  return target.isContentEditable;
}

interface SmartViewShortcutHandlers {
  views: SmartView[];
  onSelectView: (criteria: FilterCriteria) => void;
  onClearView: () => void;
  onActiveViewChange?: (viewId: string | null) => void;
}

/**
 * Hook to handle keyboard shortcuts for smart views
 *
 * Shortcuts:
 * - '1-9': Select pinned smart view at that index
 * - '0': Clear active smart view filter
 *
 * Shortcuts are disabled when typing in input fields.
 */
export function useSmartViewShortcuts({
  views,
  onSelectView,
  onClearView,
  onActiveViewChange
}: SmartViewShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (isTypingElement(event.target)) {
        return;
      }

      // Handle number keys 1-9
      if (event.key >= '1' && event.key <= '9') {
        const index = parseInt(event.key) - 1;
        const view = views[index];

        if (view) {
          event.preventDefault();
          onSelectView(view.criteria);
          onActiveViewChange?.(view.id);
        }
        return;
      }

      // Handle '0' to clear filter
      if (event.key === '0') {
        event.preventDefault();
        onClearView();
        onActiveViewChange?.(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [views, onSelectView, onClearView, onActiveViewChange]);
}
