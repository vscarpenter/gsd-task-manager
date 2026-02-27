/**
 * Sync engine - main entry point (backward compatible re-export)
 * All sync logic is now modularized in lib/sync/engine/
 */

export { SyncEngine, getSyncEngine } from './engine/coordinator';
