/**
 * Sync engine - main entry point
 *
 * Re-exports the PocketBase sync engine functions.
 * The old SyncEngine class and its getSyncEngine() singleton are replaced
 * by standalone functions in pb-sync-engine.ts, coordinated via SyncCoordinator.
 */

export { fullSync, pushLocalChanges, pullRemoteChanges, applyRemoteChange } from './pb-sync-engine';
