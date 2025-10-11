import { useEffect, RefObject } from "react";

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
      // Don't trigger shortcuts when typing in input fields
      if (isTypingElement(event.target)) {
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
