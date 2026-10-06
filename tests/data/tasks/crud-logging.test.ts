import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { createTask, deleteTask, restoreTask, updateTask } from "@/lib/tasks";
import { createMockTaskDraft } from "@/tests/fixtures";

/**
 * SEC-011: the production console is somewhere task content can leak from, such
 * as a shared screen or a support screenshot, so task operations log ids only.
 */

const { logged } = vi.hoisted(() => ({ logged: vi.fn() }));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ debug: logged, info: logged, warn: logged, error: logged }),
}));

const CREATED_TITLE = "Draft the reorg announcement";
const EDITED_TITLE = "Tell the team about the reorg";

describe("task operation logs", () => {
  beforeEach(async () => {
    logged.mockClear();
    await getDb().tasks.clear();
    await getDb().deletedTasks.clear();
  });

  it("carry no task title through create, update, delete, and restore", async () => {
    const task = await createTask(createMockTaskDraft({ title: CREATED_TITLE }));
    await updateTask(task.id, { title: EDITED_TITLE });
    const edited = (await getDb().tasks.get(task.id))!;
    await deleteTask(task.id);
    await restoreTask(edited);

    expect(logged).toHaveBeenCalled();
    const output = JSON.stringify(logged.mock.calls);
    expect(output).not.toContain(CREATED_TITLE);
    expect(output).not.toContain(EDITED_TITLE);
  });
});
