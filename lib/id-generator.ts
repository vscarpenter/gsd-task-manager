import { nanoid } from "nanoid";

/**
 * Standard ID length for all entities in the application
 */
export const ID_LENGTH = 12;

/**
 * Generate a unique ID for tasks, subtasks, and smart views
 *
 * Uses nanoid with a fixed length for consistency across the application.
 * This provides ~21 million years of generating 1000 IDs per hour before
 * a 1% probability of collision.
 */
export function generateId(): string {
  return nanoid(ID_LENGTH);
}
