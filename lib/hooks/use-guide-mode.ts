"use client";

import { useState, useCallback } from "react";

export type GuideMode = "wizard" | "accordion";

interface UseGuideModeReturn {
  mode: GuideMode;
  setMode: (mode: GuideMode) => void;
  toggleMode: () => void;
  isWizard: boolean;
  isAccordion: boolean;
}

/**
 * Hook for managing user guide display mode
 * Wizard mode: Step-by-step guided experience
 * Accordion mode: Traditional expandable sections for quick reference
 */
export function useGuideMode(defaultMode: GuideMode = "wizard"): UseGuideModeReturn {
  const [mode, setMode] = useState<GuideMode>(defaultMode);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "wizard" ? "accordion" : "wizard"));
  }, []);

  return {
    mode,
    setMode,
    toggleMode,
    isWizard: mode === "wizard",
    isAccordion: mode === "accordion",
  };
}
