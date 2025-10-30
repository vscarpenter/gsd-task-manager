/**
 * Settings dialog module - main entry point
 *
 * This file re-exports the SettingsDialog component from the modular structure
 * for backward compatibility with existing imports.
 *
 * Modular structure:
 * - settings/settings-dialog.tsx - Main dialog wrapper with state management
 * - settings/appearance-settings.tsx - Theme and display preferences
 * - settings/notification-settings.tsx - Notification configuration
 * - settings/data-management.tsx - Import/export and storage stats
 * - settings/about-section.tsx - Version and app information
 */

export { SettingsDialog } from "./settings/settings-dialog";
