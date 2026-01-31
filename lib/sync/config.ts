/**
 * Sync Configuration - Re-export Layer
 *
 * This file maintains backward compatibility for existing imports.
 * All operations have been modularized into lib/sync/config/ directory.
 *
 * @see lib/sync/config/index.ts for the modular implementation
 */

export {
  getSyncConfig,
  updateSyncConfig,
  getAutoSyncConfig,
  updateAutoSyncConfig,
  isSyncEnabled,
  getSyncStatus,
  enableSync,
  disableSync,
  resetAndFullSync,
} from "./config/index";
