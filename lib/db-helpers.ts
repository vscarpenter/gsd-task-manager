/**
 * Database helper functions
 * Centralizes common get/put patterns for settings tables
 */

import type { Table } from 'dexie';
import type { ZodSchema } from 'zod';
import { getDb } from '@/lib/db';

/**
 * Get a settings record from the database, creating defaults if not found
 *
 * @param table - Dexie table to query
 * @param id - Primary key (typically "settings")
 * @param defaults - Default values to use if record doesn't exist
 * @returns The existing or newly created settings record
 */
export async function getOrCreateSettings<T extends { id: string }>(
  table: Table<T, string>,
  id: string,
  defaults: T
): Promise<T> {
  const existing = await table.get(id);

  if (existing) {
    return existing;
  }

  await table.add(defaults);
  return defaults;
}

/**
 * Update a settings record with partial values
 * Gets current values, merges updates, validates, and saves
 *
 * @param table - Dexie table to update
 * @param id - Primary key (typically "settings")
 * @param getCurrent - Function to get current settings (handles defaults)
 * @param updates - Partial updates to apply
 * @param schema - Zod schema for validation
 */
export async function updateSettings<T extends { id: string; updatedAt?: string }>(
  table: Table<T, string>,
  id: string,
  getCurrent: () => Promise<T>,
  updates: Partial<T>,
  schema: ZodSchema<T>
): Promise<void> {
  const current = await getCurrent();

  const updated = {
    ...current,
    ...updates,
    id, // Ensure ID is preserved
    updatedAt: new Date().toISOString(),
  } as T;

  const validated = schema.parse(updated);
  await table.put(validated);
}

/**
 * Clean up old records from a table, keeping only the most recent
 *
 * @param tableName - Name of the table to clean up
 * @param timestampField - Field to sort by (must be string ISO timestamp)
 * @param maxRecords - Maximum records to keep
 * @returns Number of records deleted
 */
export async function cleanupOldRecords(
  tableName: 'syncHistory' | 'archivedTasks',
  timestampField: string,
  maxRecords: number
): Promise<number> {
  const db = getDb();
  const table = db[tableName];

  const count = await table.count();

  if (count <= maxRecords) {
    return 0;
  }

  const recordsToDelete = count - maxRecords;

  // Get oldest records
  const oldestRecords = await table
    .orderBy(timestampField)
    .limit(recordsToDelete)
    .toArray();

  // Delete them
  const idsToDelete = oldestRecords.map((r: { id: string }) => r.id);
  await table.bulkDelete(idsToDelete);

  return recordsToDelete;
}
