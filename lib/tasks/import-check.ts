import { importPayloadSchema } from "@/lib/schema";
import { assertRawSmartViewBounds } from "@/lib/tasks/smart-view-import-bounds";
import { assertWithinImportCap, assertWithinImportSize } from "@/lib/tasks/import-export";

export type ImportCheck = { ok: true } | { ok: false; message: string };

const NOT_A_BACKUP = "This is not a GSD backup file.";

/** What a row is called in a message, by the list it sits in. */
const ROW_LABELS: Record<string, string> = {
  tasks: "Task",
  archivedTasks: "Archived task",
  deletedTasks: "Deleted task",
};

interface Issue {
  code: string;
  path: PropertyKey[];
  message: string;
  origin?: string;
  maximum?: number | bigint;
}

/** The part of a sentence that says what is wrong with one field. */
function describeProblem(issue: Issue): string {
  const limit = issue.maximum === undefined ? "" : ` (${issue.maximum} at most)`;
  if (issue.code === "too_big" && issue.origin === "string") {
    return `is too long (${issue.maximum} characters at most)`;
  }
  if (issue.code === "too_big" && issue.origin === "array") return `has too many items${limit}`;
  if (issue.code === "too_big") return `is too large${limit}`;
  if (issue.code === "too_small") return issue.origin === "string" ? "is too short" : "is too small";
  return "is missing or not valid";
}

/** One sentence naming the row, the field, and the limit it broke. */
function describeIssue(issue: Issue): string {
  const [list, index, field] = issue.path;
  const rowLabel = typeof list === "string" ? ROW_LABELS[list] : undefined;
  if (rowLabel && typeof index === "number") {
    const where = typeof field === "string" ? `the ${field}` : "the record";
    return `${rowLabel} ${index + 1}: ${where} ${describeProblem(issue)}.`;
  }
  const key = typeof list === "string" ? list : "file";
  return `The backup's "${key}" ${describeProblem(issue)}.`;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("This file isn't valid JSON, so it can't be a GSD backup.");
  }
}

function looksLikeBackup(parsed: unknown): parsed is Record<string, unknown> {
  return (
    parsed !== null &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { tasks?: unknown }).tasks)
  );
}

function runChecks(raw: string): void {
  assertWithinImportSize(raw);
  const parsed = parseJson(raw);
  if (!looksLikeBackup(parsed)) throw new Error(NOT_A_BACKUP);

  assertRawSmartViewBounds(parsed as never);
  const result = importPayloadSchema.safeParse(parsed);
  if (!result.success) throw new Error(describeIssue(result.error.issues[0] as Issue));
  assertWithinImportCap(result.data);
}

/**
 * Whether a chosen file can be imported at all, checked before the dialog
 * offers Merge or Replace. It runs the same schema and cap that
 * `importTasks` runs, so a file that passes here cannot fail them later; it
 * only turns their failure into a sentence a person can act on.
 */
export function checkImportFile(raw: string): ImportCheck {
  try {
    runChecks(raw);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : NOT_A_BACKUP };
  }
}
