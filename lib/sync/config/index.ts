/**
 * Sync Configuration Module
 *
 * This module provides all sync configuration management functions.
 * Re-exports from modular files for backward compatibility.
 */

// Get/Set operations
export {
  getSyncConfig,
  updateSyncConfig,
  getAutoSyncConfig,
  updateAutoSyncConfig,
  isSyncEnabled,
  getSyncStatus,
} from "./get-set";

// Enable sync
export { enableSync } from "./enable";

// Disable sync
export { disableSync } from "./disable";

// Reset operations
export { resetAndFullSync } from "./reset";
