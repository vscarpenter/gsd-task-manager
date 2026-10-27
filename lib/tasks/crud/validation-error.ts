import type { z } from "zod";

/** One failed field: names, codes, and limits only, never the user's text. */
export interface TaskValidationIssue {
  path: readonly PropertyKey[];
  code: string;
  /** "string" or "array" on a too_big issue, so a tag's length reads apart from the tag count. */
  origin?: string;
  maximum?: number;
}

export class TaskValidationError extends Error {
  readonly issues: readonly TaskValidationIssue[];

  constructor(issues: readonly TaskValidationIssue[], summary: string) {
    super(`Task validation failed: ${summary}`);
    this.name = "TaskValidationError";
    this.issues = issues;
  }

  static fromZod(error: z.ZodError, summary: string): TaskValidationError {
    return new TaskValidationError(error.issues.map(toIssue), summary);
  }
}

function toIssue(issue: z.ZodError["issues"][number]): TaskValidationIssue {
  if (issue.code !== "too_big") return { path: issue.path, code: issue.code };
  return { path: issue.path, code: issue.code, origin: issue.origin, maximum: Number(issue.maximum) };
}

type LimitCopy = (maximum: number) => string;

const STRING_LIMITS: Record<string, LimitCopy> = {
  title: (max) => `Titles can be up to ${max} characters.`,
  description: (max) => `Descriptions can be up to ${max} characters.`,
  tags: (max) => `Tags can be up to ${max} characters.`,
  subtasks: (max) => `Subtask titles can be up to ${max} characters.`,
};

const LIST_LIMITS: Record<string, LimitCopy> = {
  tags: (max) => `A task can have up to ${max} tags.`,
  subtasks: (max) => `A task can have up to ${max} subtasks.`,
  dependencies: (max) => `A task can depend on up to ${max} other tasks.`,
};

/**
 * A sentence a person can act on, or null when the error is not a limit we can
 * name. "Failed to save task" left people guessing which field to shorten.
 */
export function taskValidationMessage(error: unknown): string | null {
  if (!(error instanceof TaskValidationError)) return null;
  for (const issue of error.issues) {
    if (issue.code !== "too_big" || issue.maximum === undefined) continue;
    const limits = issue.origin === "array" ? LIST_LIMITS : STRING_LIMITS;
    const copy = limits[String(issue.path[0])];
    if (copy) return copy(issue.maximum);
  }
  return null;
}
