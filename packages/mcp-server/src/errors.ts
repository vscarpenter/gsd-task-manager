/**
 * Typed error classes for the MCP server.
 */

/**
 * Thrown when a precondition check (e.g., the PocketBase `client_updated_at`
 * value has not changed between the read and the write) fails.
 *
 * Carries both the timestamp seen at read time and the timestamp seen
 * immediately before the write so the caller — or the LLM — can decide how to
 * recover (re-fetch the task and retry, surface to the user, etc.).
 */
export class ConflictError extends Error {
  readonly name = 'ConflictError';

  constructor(
    readonly taskId: string,
    readonly readClientUpdatedAt: string,
    readonly currentClientUpdatedAt: string
  ) {
    super(
      `Task ${taskId} changed between read and write ` +
        `(read: ${readClientUpdatedAt}, current: ${currentClientUpdatedAt}). ` +
        `Re-fetch the task and retry.`
    );
  }
}
