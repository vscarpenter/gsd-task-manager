import { useEffect, type RefObject } from "react";

import {
  hasOpenModal,
  isEditableShortcutTarget,
} from "@/lib/use-app-shortcuts";

interface KeyboardShortcutHandlers {
  onNewTask: () => void;
  onSearch: () => void;
  onHelp: () => void;
}

/**
 * Hook to handle global keyboard shortcuts
 *
 * Shortcuts:
 * - 'n' or 'N': Create new task
 * - '/': Focus search
 * - '?' or 'Shift+/': Open help
 *
 * Shortcuts are disabled when typing in input fields.
 */
export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  searchInputRef?: RefObject<HTMLInputElement | null>
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Leave modified keys to the app shell and never fire behind a modal.
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableShortcutTarget(event.target) ||
        hasOpenModal()
      ) {
        return;
      }

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        handlers.onNewTask();
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        if (searchInputRef?.current) {
          searchInputRef.current.focus();
        } else {
          handlers.onSearch();
        }
        return;
      }

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        handlers.onHelp();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, searchInputRef]);
}
