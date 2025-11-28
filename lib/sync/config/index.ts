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

// Account operations
export { registerSyncAccount, loginSyncAccount } from "./account";

// Reset operations
export { resetAndFullSync } from "./reset";
