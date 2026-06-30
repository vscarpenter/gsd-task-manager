import {
  PaletteIcon,
  BellIcon,
  CloudIcon,
  ArchiveIcon,
  DatabaseIcon,
  InfoIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react";

export type SettingsSectionId =
  | "appearance"
  | "features"
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
  { id: "features", label: "Features", icon: SlidersHorizontalIcon, description: "Optional workspace capabilities", group: "Preferences" },
  { id: "notifications", label: "Notifications", icon: BellIcon, description: "Reminders and alerts", group: "Preferences" },
  { id: "sync", label: "Cloud Sync", icon: CloudIcon, description: "Multi-device synchronization", group: "Preferences" },
  { id: "archive", label: "Archive", icon: ArchiveIcon, description: "Auto-archive completed tasks", group: "Data" },
  { id: "data", label: "Data & Storage", icon: DatabaseIcon, description: "Backup, import, and reset", group: "Data" },
  { id: "about", label: "About", icon: InfoIcon, description: "Version and project info", group: "Info" },
];

export const SETTINGS_SECTION_IDS = SETTINGS_SECTIONS.map((s) => s.id);
