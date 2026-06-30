"use client";

import { useEffect, useState } from "react";

import {
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_IDS,
  type SettingsSectionId,
} from "./settings-sidebar-data";

const DEFAULT_SECTION: SettingsSectionId = "appearance";

function readHashSection(): SettingsSectionId {
  if (typeof window === "undefined") return DEFAULT_SECTION;
  const hash = window.location.hash.slice(1) as SettingsSectionId;
  return SETTINGS_SECTION_IDS.includes(hash) ? hash : DEFAULT_SECTION;
}

export interface ActiveSection {
  /** The section to render — guaranteed to be currently visible. */
  activeSection: SettingsSectionId;
  /** Section ids visible given the current sync state, in display order. */
  visibleSectionIds: SettingsSectionId[];
  /** Select a section and reflect it in the URL hash. */
  selectSection: (id: SettingsSectionId) => void;
}

/**
 * Owns the settings page's active-section state.
 *
 * - The initial value comes from the URL hash via a lazy initializer (no init
 *   effect), and a single effect keeps it in sync with later `hashchange` events.
 * - The *effective* active section is derived during render: if the stored
 *   section is hidden (e.g. sync turned off), we fall back to the default
 *   rather than chaining a setState in an effect.
 */
export function useActiveSection(syncEnabled: boolean): ActiveSection {
  const [storedSection, setStoredSection] =
    useState<SettingsSectionId>(readHashSection);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setStoredSection(readHashSection());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const visibleSectionIds: SettingsSectionId[] = [];
  for (const section of SETTINGS_SECTIONS) {
    if (section.id === "sync" && !syncEnabled) continue;
    visibleSectionIds.push(section.id);
  }

  const activeSection = visibleSectionIds.includes(storedSection)
    ? storedSection
    : DEFAULT_SECTION;

  const selectSection = (id: SettingsSectionId) => {
    setStoredSection(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  return { activeSection, visibleSectionIds, selectSection };
}
