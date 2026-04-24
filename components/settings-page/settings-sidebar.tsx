"use client";

import {
  PaletteIcon,
  BellIcon,
  CloudIcon,
  ArchiveIcon,
  DatabaseIcon,
  InfoIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSectionId =
  | "appearance"
  | "notifications"
  | "sync"
  | "archive"
  | "data"
  | "about";

export type SectionGroup = "Preferences" | "Data" | "Info";

export interface SectionMeta {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  description: string;
  group: SectionGroup;
}

export const SETTINGS_SECTIONS: SectionMeta[] = [
  { id: "appearance", label: "Appearance", icon: PaletteIcon, description: "Theme and display preferences", group: "Preferences" },
  { id: "notifications", label: "Notifications", icon: BellIcon, description: "Reminders and alerts", group: "Preferences" },
  { id: "sync", label: "Cloud Sync", icon: CloudIcon, description: "Multi-device synchronization", group: "Preferences" },
  { id: "archive", label: "Archive", icon: ArchiveIcon, description: "Auto-archive completed tasks", group: "Data" },
  { id: "data", label: "Data & Storage", icon: DatabaseIcon, description: "Backup, import, and reset", group: "Data" },
  { id: "about", label: "About", icon: InfoIcon, description: "Version and project info", group: "Info" },
];

export const SETTINGS_SECTION_IDS = SETTINGS_SECTIONS.map((s) => s.id);

interface SettingsSidebarProps {
  activeId: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
  visibleSections: SettingsSectionId[];
}

/**
 * Left-rail navigation for the settings page.
 * Groups sections under small uppercase labels; active item gets an accent
 * vertical bar and tinted pill. Collapses into a horizontal scroller on mobile.
 */
export function SettingsSidebar({ activeId, onSelect, visibleSections }: SettingsSidebarProps) {
  const sections = SETTINGS_SECTIONS.filter((s) => visibleSections.includes(s.id));
  const groups = groupByGroup(sections);

  return (
    <>
      {/* Mobile: horizontal pill nav */}
      <nav
        aria-label="Settings sections"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                "min-h-11",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                isActive
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-card text-foreground-muted hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </button>
          );
        })}
      </nav>

      {/* Desktop: vertical nav card */}
      <aside className="hidden lg:block lg:w-[260px] lg:shrink-0">
        <div className="sticky top-24 rounded-2xl border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {groups.map(({ group, items }) => (
            <div key={group} className="pb-2 last:pb-0">
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground-muted/80">
                {group}
              </p>
              <ul className="space-y-0.5">
                {items.map((section) => (
                  <li key={section.id}>
                    <SidebarItem
                      section={section}
                      isActive={section.id === activeId}
                      onSelect={() => onSelect(section.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

interface SidebarItemProps {
  section: SectionMeta;
  isActive: boolean;
  onSelect: () => void;
}

function SidebarItem({ section, isActive, onSelect }: SidebarItemProps) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        isActive
          ? "bg-accent/10 text-foreground"
          : "text-foreground-muted hover:bg-background-muted hover:text-foreground",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Active accent bar */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-opacity",
          isActive ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          isActive ? "text-accent" : "text-foreground-muted group-hover:text-foreground",
        )}
      />
      <span className={cn("font-medium", isActive && "text-foreground")}>
        {section.label}
      </span>
    </button>
  );
}

function groupByGroup(sections: SectionMeta[]): { group: SectionGroup; items: SectionMeta[] }[] {
  const order: SectionGroup[] = ["Preferences", "Data", "Info"];
  return order
    .map((group) => ({ group, items: sections.filter((s) => s.group === group) }))
    .filter(({ items }) => items.length > 0);
}
