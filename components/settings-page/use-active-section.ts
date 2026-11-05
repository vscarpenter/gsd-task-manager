"use client";

import { useSyncExternalStore } from "react";

import {
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_IDS,
  type SettingsSectionId,
} from "./settings-sidebar-data";

const DEFAULT_SECTION: SettingsSectionId = "appearance";
/** Fired after selectSection rewrites the hash, which replaceState does silently. */
const SECTION_SELECTED_EVENT = "gsd:settings-section-selected";

function readHashSection(): SettingsSectionId {
  const hash = window.location.hash.slice(1) as SettingsSectionId;
  return SETTINGS_SECTION_IDS.includes(hash) ? hash : DEFAULT_SECTION;
}

const readServerSection = (): SettingsSectionId => DEFAULT_SECTION;

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(SECTION_SELECTED_EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(SECTION_SELECTED_EVENT, onChange);
  };
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
 * Owns the settings page's active-section state, read straight from the URL hash.
 *
 * - The hash is an external store. A client-side link to `/settings#feedback`
 *   renders this page before the App Router writes the URL, and pushState fires
 *   no event; useSyncExternalStore rechecks the hash after commit, so the
 *   section still opens (the palette bug recorded on 2026-11-02).
 * - The *effective* active section is derived during render: if the stored
 *   section is hidden (e.g. sync turned off), we fall back to the default
 *   rather than chaining a setState in an effect.
 */
export function useActiveSection(syncEnabled: boolean): ActiveSection {
  const storedSection = useSyncExternalStore(subscribeToHash, readHashSection, readServerSection);

  const visibleSectionIds: SettingsSectionId[] = [];
  for (const section of SETTINGS_SECTIONS) {
    if (section.id === "sync" && !syncEnabled) continue;
    visibleSectionIds.push(section.id);
  }

  const activeSection = visibleSectionIds.includes(storedSection)
    ? storedSection
    : DEFAULT_SECTION;

  const selectSection = (id: SettingsSectionId) => {
    window.history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new Event(SECTION_SELECTED_EVENT));
  };

  return { activeSection, visibleSectionIds, selectSection };
}
