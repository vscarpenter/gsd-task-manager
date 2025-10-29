/**
 * Sync engine - main entry point (backward compatible re-export)
 * All sync logic is now modularized in lib/sync/engine/
 */

import { SyncEngine as SyncEngineClass } from './engine/coordinator';

export { SyncEngineClass as SyncEngine };

// Singleton instance
let engineInstance: SyncEngineClass | null = null;

/**
 * Get or create sync engine instance
 */
export function getSyncEngine() {
  if (!engineInstance) {
    engineInstance = new SyncEngineClass();
  }
  return engineInstance;
}
