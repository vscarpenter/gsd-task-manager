# Edit-Drawer Dependencies ("Depends on") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `tasks/spec.md` § "Restore dependency-linking ('Depends on') UI in the v9 edit drawer" (2026-07-05). Read it first — acceptance criteria AC1–AC9 referenced below are defined there.

**Goal:** Add a "Depends on" field to the v9 edit drawer so users can link tasks again (lost with the v8 task form in PR #238), reusing the existing `lib/dependencies.ts` graph logic and the already-working `dependencies` persistence in `createTask`/`updateTask`.

**Architecture:** One new pure component (`DependenciesField`) receives the live task list via props (no Dexie access inside — unit-testable without fakes). Draft state extends the existing `useEditDraftState` hook. The drawer gains an `allTasks` prop and a save-time cycle guard. The shell (`index.tsx`) passes `all` from its existing `useTasks()` call and forwards `dependencies` on the create path. **No schema, Dexie, sync, or MCP changes.**

**Tech Stack:** Next.js 16 App Router, React (compiler ON — no manual memoization), TypeScript strict, Tailwind (Inkwell tokens), Vitest + @testing-library/react (`bun run test`, NOT `bun test`), lucide-react icons.

## Global Constraints

- TDD: every behavior change starts with a failing test; confirm red fails for the right reason before green.
- Files ≤350 lines; keep functions small; nesting ≤3; no magic numbers (name them).
- No new dependencies. Imports use the `@/` alias.
- Never commit on `main` — a PreToolUse hook blocks it. All work on branch `feat/edit-drawer-dependencies`.
- Commit format `<type>(<scope>): <description>` (imperative, lowercase, ≤72 chars); end commit messages with the Claude-Session trailer per repo convention.
- Run tests with `bun run test -- <file>` (delegates to vitest). `bun test` invokes bun's own runner and will fail — never use it.
- Coverage for changed files ≥80% (statements/lines/functions).
- Design: calm Inkwell idiom — reuse the drawer's `Field` label primitive and the tags-field chip styling; error text uses the existing `text-xs text-red-400` idiom; no new colors.
- Never silently drop dependency IDs that don't resolve to a local task (they may reference tasks not yet synced from another device).
- `SCHEMA_LIMITS.MAX_DEPENDENCIES` = 50 (`lib/constants/schema.ts:38`) — always reference the constant, never the literal.

---

### Task 1: `DependenciesField` component

**Files:**
- Create: `components/matrix-simplified/edit-drawer-dependencies.tsx`
- Create: `tests/ui/edit-drawer-dependencies.test.tsx`

**Interfaces:**
- Consumes: `wouldCreateCircularDependency(taskId, depId, allTasks)` from `@/lib/dependencies`; `SCHEMA_LIMITS` from `@/lib/constants/schema`; `Field` from `./edit-drawer-fields`; `TaskRecord` from `@/lib/types`.
- Produces (Task 2 relies on these exact signatures):
  - `DependenciesField(props: { taskId?: string; dependencies: string[]; allTasks: TaskRecord[]; onChange: (ids: string[]) => void; error?: string | null }): React.ReactElement`
  - `findDependencyCycleError(taskId: string, dependencies: string[], allTasks: TaskRecord[]): string | null`
  - Test hooks: `data-testid="dep-chip"` on chips, `data-testid="dep-suggestion"` on suggestion buttons; search input `aria-label="Search tasks to add as a dependency"`; remove buttons `aria-label="Remove dependency {title}"`.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/edit-drawer-dependencies
```

- [ ] **Step 2: Write failing tests — rendering (AC1) + cycle-guard helper (AC7)**

Create `tests/ui/edit-drawer-dependencies.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DependenciesField,
  findDependencyCycleError,
} from "@/components/matrix-simplified/edit-drawer-dependencies";
import type { TaskRecord } from "@/lib/types";

function makeTask(overrides: Partial<TaskRecord> & { id: string }): TaskRecord {
  return {
    title: overrides.id,
    description: "",
    urgent: true,
    important: true,
    quadrant: "urgent-important",
    completed: false,
    tags: [],
    subtasks: [],
    dependencies: [],
    recurrence: "none",
    notificationEnabled: false,
    notificationSent: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as TaskRecord;
}

describe("<DependenciesField>", () => {
  it("should_render_chip_with_task_title_for_each_resolvable_dependency", () => {
    const tasks = [
      makeTask({ id: "a", title: "Write spec" }),
      makeTask({ id: "b", title: "Review spec" }),
      makeTask({ id: "z", title: "Ship it" }),
    ];
    render(
      <DependenciesField taskId="z" dependencies={["a", "b"]} allTasks={tasks} onChange={vi.fn()} />
    );
    expect(screen.getAllByTestId("dep-chip")).toHaveLength(2);
    expect(screen.getByText("Write spec")).toBeInTheDocument();
    expect(screen.getByText("Review spec")).toBeInTheDocument();
  });

  it("should_not_render_chip_for_ghost_dependency_id", () => {
    render(
      <DependenciesField
        taskId="z"
        dependencies={["ghost-1"]}
        allTasks={[makeTask({ id: "z", title: "Ship it" })]}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByTestId("dep-chip")).toHaveLength(0);
    expect(screen.getByLabelText(/search tasks/i)).toBeInTheDocument();
  });

  it("should_render_chip_for_completed_dependency_so_it_can_be_removed", () => {
    const tasks = [
      makeTask({ id: "a", title: "Done thing", completed: true }),
      makeTask({ id: "z", title: "Ship it" }),
    ];
    render(<DependenciesField taskId="z" dependencies={["a"]} allTasks={tasks} onChange={vi.fn()} />);
    expect(screen.getByText("Done thing")).toBeInTheDocument();
  });
});

describe("findDependencyCycleError", () => {
  it("should_return_message_naming_the_blocking_task_when_cycle_found", () => {
    // "Alpha" depends on "Beta"; making Beta depend on Alpha closes the loop.
    const tasks = [
      makeTask({ id: "a", title: "Alpha", dependencies: ["b"] }),
      makeTask({ id: "b", title: "Beta" }),
    ];
    expect(findDependencyCycleError("b", ["a"], tasks)).toMatch(/Alpha/);
  });

  it("should_return_null_for_ghost_ids_and_acyclic_dependencies", () => {
    const tasks = [makeTask({ id: "a", title: "Alpha" }), makeTask({ id: "b", title: "Beta" })];
    expect(findDependencyCycleError("b", ["a", "ghost-1"], tasks)).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests — verify they fail for the right reason**

Run: `bun run test -- tests/ui/edit-drawer-dependencies.test.tsx`
Expected: FAIL — cannot resolve `@/components/matrix-simplified/edit-drawer-dependencies` (module doesn't exist yet).

- [ ] **Step 4: Implement rendering + cycle helper (minimal green)**

Create `components/matrix-simplified/edit-drawer-dependencies.tsx`:

```tsx
"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { wouldCreateCircularDependency } from "@/lib/dependencies";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { Field } from "./edit-drawer-fields";

const MAX_SUGGESTIONS = 8;

/**
 * Save-time cycle guard for the edit drawer. Unlike lib's validateDependencies,
 * IDs that don't resolve locally are skipped rather than rejected — they may
 * reference tasks that haven't synced to this device yet and must be preserved.
 */
export function findDependencyCycleError(
  taskId: string,
  dependencies: string[],
  allTasks: TaskRecord[]
): string | null {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  for (const depId of dependencies) {
    const dep = byId.get(depId);
    if (!dep) continue;
    if (wouldCreateCircularDependency(taskId, depId, allTasks)) {
      return `Circular dependency: "${dep.title}" already depends on this task.`;
    }
  }
  return null;
}

interface DependenciesFieldProps {
  /** Undefined in create mode — cycle filtering is skipped (nothing can depend on an unsaved task). */
  taskId?: string;
  dependencies: string[];
  allTasks: TaskRecord[];
  onChange: (ids: string[]) => void;
  error?: string | null;
}

export function DependenciesField({
  taskId,
  dependencies,
  allTasks,
  onChange,
  error,
}: DependenciesFieldProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  // Ghost IDs (no local record) render no chip but stay in `dependencies`.
  const chips = dependencies
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is TaskRecord => t !== undefined);
  const atLimit = dependencies.length >= SCHEMA_LIMITS.MAX_DEPENDENCIES;

  return (
    <Field label="Depends on">
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2">
          {chips.map((t) => (
            <span
              key={t.id}
              data-testid="dep-chip"
              className="inline-flex items-center gap-1 rounded bg-background-muted px-2 py-0.5 text-[11.5px] font-medium text-foreground-muted"
            >
              {t.title}
              <button
                type="button"
                onClick={() => onChange(dependencies.filter((id) => id !== t.id))}
                aria-label={`Remove dependency ${t.title}`}
                className="hover:text-foreground"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={query}
            disabled={atLimit}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder={chips.length ? "" : "Search tasks this one depends on…"}
            aria-label="Search tasks to add as a dependency"
            className="min-w-[80px] flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none disabled:cursor-not-allowed"
          />
        </div>
        <Suggestions
          open={open}
          query={query}
          taskId={taskId}
          dependencies={dependencies}
          allTasks={allTasks}
          onPick={(id) => {
            onChange([...dependencies, id]);
            setQuery("");
            setOpen(false);
          }}
        />
      </div>
      {atLimit ? (
        <p className="text-[11.5px] text-foreground-muted">
          Dependency limit reached ({SCHEMA_LIMITS.MAX_DEPENDENCIES}).
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </Field>
  );
}

function isCandidate(
  candidate: TaskRecord,
  taskId: string | undefined,
  dependencies: string[],
  allTasks: TaskRecord[]
): boolean {
  if (candidate.id === taskId) return false;
  if (dependencies.includes(candidate.id)) return false;
  if (candidate.completed) return false;
  if (taskId && wouldCreateCircularDependency(taskId, candidate.id, allTasks)) return false;
  return true;
}

function Suggestions({
  open,
  query,
  taskId,
  dependencies,
  allTasks,
  onPick,
}: {
  open: boolean;
  query: string;
  taskId?: string;
  dependencies: string[];
  allTasks: TaskRecord[];
  onPick: (id: string) => void;
}): React.ReactElement | null {
  const trimmed = query.trim().toLowerCase();
  if (!open || !trimmed) return null;

  const matches = allTasks
    .filter((t) => isCandidate(t, taskId, dependencies, allTasks))
    .filter((t) => t.title.toLowerCase().includes(trimmed))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      {matches.length > 0 ? (
        matches.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid="dep-suggestion"
            onClick={() => onPick(t.id)}
            className="block w-full truncate px-3 py-2 text-left text-[13px] text-foreground hover:bg-background-muted"
          >
            {t.title}
          </button>
        ))
      ) : (
        <p className="px-3 py-2 text-[12.5px] text-foreground-muted">No matching tasks.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests — verify green**

Run: `bun run test -- tests/ui/edit-drawer-dependencies.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add components/matrix-simplified/edit-drawer-dependencies.tsx tests/ui/edit-drawer-dependencies.test.tsx
git commit -m "feat(matrix): add DependenciesField chips + cycle guard helper"
```

- [ ] **Step 7: Write failing tests — search, add, exclusions (AC2, AC3)**

Append to the `describe("<DependenciesField>")` block:

```tsx
  it("should_list_matching_candidates_when_typing_and_cap_at_eight", async () => {
    const user = userEvent.setup();
    const tasks = [
      ...Array.from({ length: 12 }, (_, i) => makeTask({ id: `t${i}`, title: `Report ${i}` })),
      makeTask({ id: "z", title: "Ship it" }),
    ];
    render(<DependenciesField taskId="z" dependencies={[]} allTasks={tasks} onChange={vi.fn()} />);
    await user.type(screen.getByLabelText(/search tasks/i), "report");
    expect(screen.getAllByTestId("dep-suggestion")).toHaveLength(8);
  });

  it("should_add_id_and_clear_query_when_suggestion_clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tasks = [makeTask({ id: "a", title: "Draft report" }), makeTask({ id: "z", title: "Ship it" })];
    render(<DependenciesField taskId="z" dependencies={[]} allTasks={tasks} onChange={onChange} />);
    const input = screen.getByLabelText(/search tasks/i) as HTMLInputElement;
    await user.type(input, "draft");
    await user.click(screen.getByTestId("dep-suggestion"));
    expect(onChange).toHaveBeenCalledWith(["a"]);
    expect(input.value).toBe("");
  });

  it("should_exclude_self_selected_completed_and_circular_candidates", async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: "self", title: "Self task" }),
      makeTask({ id: "picked", title: "Picked task" }),
      makeTask({ id: "done", title: "Done task", completed: true }),
      makeTask({ id: "cyc", title: "Cycle task", dependencies: ["self"] }),
      makeTask({ id: "ok", title: "Ok task" }),
    ];
    render(
      <DependenciesField taskId="self" dependencies={["picked"]} allTasks={tasks} onChange={vi.fn()} />
    );
    await user.type(screen.getByLabelText(/search tasks/i), "task");
    const suggestions = screen.getAllByTestId("dep-suggestion").map((b) => b.textContent);
    expect(suggestions).toEqual(["Ok task"]);
  });

  it("should_exclude_transitively_circular_candidate", async () => {
    const user = userEvent.setup();
    // Alpha → Beta → Gamma; editing Gamma, adding Alpha would close the loop.
    const tasks = [
      makeTask({ id: "a", title: "Alpha", dependencies: ["b"] }),
      makeTask({ id: "b", title: "Beta", dependencies: ["c"] }),
      makeTask({ id: "c", title: "Gamma" }),
    ];
    render(<DependenciesField taskId="c" dependencies={[]} allTasks={tasks} onChange={vi.fn()} />);
    await user.type(screen.getByLabelText(/search tasks/i), "alpha");
    expect(screen.queryAllByTestId("dep-suggestion")).toHaveLength(0);
    expect(screen.getByText(/no matching tasks/i)).toBeInTheDocument();
  });
```

- [ ] **Step 8: Run tests**

Run: `bun run test -- tests/ui/edit-drawer-dependencies.test.tsx`
Expected: PASS — the Step 4 implementation already covers search/exclusions. If any of these four fail, fix the implementation (not the test) until green. Either way this step ends green; the red/green value here is confirming the exclusion matrix is actually exercised.

- [ ] **Step 9: Write failing tests — remove/ghost-preserve, Enter guard, limit, empty states (AC4, AC5, AC6, AC8, AC9)**

Append to the `describe("<DependenciesField>")` block:

```tsx
  it("should_remove_only_targeted_id_and_preserve_ghost_ids_on_remove", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tasks = [makeTask({ id: "a", title: "Alpha" }), makeTask({ id: "z", title: "Ship it" })];
    render(
      <DependenciesField taskId="z" dependencies={["ghost-1", "a"]} allTasks={tasks} onChange={onChange} />
    );
    await user.click(screen.getByRole("button", { name: "Remove dependency Alpha" }));
    expect(onChange).toHaveBeenCalledWith(["ghost-1"]);
  });

  it("should_not_submit_enclosing_form_when_enter_pressed_in_search", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DependenciesField
          dependencies={[]}
          allTasks={[makeTask({ id: "a", title: "Alpha" })]}
          onChange={vi.fn()}
        />
      </form>
    );
    await user.type(screen.getByLabelText(/search tasks/i), "alp{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("should_allow_adding_candidates_in_create_mode_without_task_id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DependenciesField
        dependencies={[]}
        allTasks={[makeTask({ id: "a", title: "Alpha" })]}
        onChange={onChange}
      />
    );
    await user.type(screen.getByLabelText(/search tasks/i), "alp");
    await user.click(screen.getByTestId("dep-suggestion"));
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("should_disable_search_input_with_caption_at_max_dependencies", () => {
    const deps = Array.from({ length: 50 }, (_, i) => `d${i}`);
    render(<DependenciesField taskId="z" dependencies={deps} allTasks={[]} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/search tasks/i)).toBeDisabled();
    expect(screen.getByText(/dependency limit/i)).toBeInTheDocument();
  });

  it("should_show_no_matching_tasks_message_when_query_has_no_candidates", async () => {
    const user = userEvent.setup();
    render(
      <DependenciesField
        taskId="z"
        dependencies={[]}
        allTasks={[makeTask({ id: "z", title: "Ship it" })]}
        onChange={vi.fn()}
      />
    );
    await user.type(screen.getByLabelText(/search tasks/i), "anything");
    expect(screen.getByText(/no matching tasks/i)).toBeInTheDocument();
  });
```

- [ ] **Step 10: Run full field test file — verify all green**

Run: `bun run test -- tests/ui/edit-drawer-dependencies.test.tsx`
Expected: PASS (11 tests). Fix implementation if any behavior gap surfaces.

- [ ] **Step 11: Commit**

```bash
git add tests/ui/edit-drawer-dependencies.test.tsx components/matrix-simplified/edit-drawer-dependencies.tsx
git commit -m "test(matrix): cover DependenciesField search, exclusions, limits"
```

---

### Task 2: Wire the field into the edit drawer

**Files:**
- Modify: `components/matrix-simplified/edit-drawer.tsx` (EditDraft type ~line 13-20; props ~line 22-29; form body after `TagsField` ~line 158; `submit` ~line 67)
- Modify: `components/matrix-simplified/use-edit-draft-state.ts` (interface ~line 29-50; hook body ~line 63-79; `toDraft` ~line 97-108)
- Test: `tests/ui/edit-drawer.test.tsx` (append a new `describe` block)

**Interfaces:**
- Consumes: `DependenciesField`, `findDependencyCycleError` from `./edit-drawer-dependencies` (Task 1 signatures).
- Produces (Task 3 relies on these):
  - `EditDraft` gains `dependencies: string[]` (always present in `toDraft()` output).
  - `EditDrawerProps` gains `allTasks?: TaskRecord[]` (defaults to `[]`; existing call sites and tests stay valid).
  - `EditDraftState` gains `dependencies: string[]` and `setDependencies: (v: string[]) => void`.

- [ ] **Step 1: Write failing tests**

Append to `tests/ui/edit-drawer.test.tsx` (inside the top-level `describe("<EditDrawer>")`, after the existing a11y block; `mockTask` with `id: "t1"` already exists at the top of the file):

```tsx
  describe("dependencies field", () => {
    const otherTask: TaskRecord = { ...mockTask, id: "t2", title: "Other task", dependencies: [] };

    it("should_include_added_dependency_id_in_submitted_draft", async () => {
      const onSubmit = vi.fn();
      render(
        <EditDrawer open task={mockTask} allTasks={[mockTask, otherTask]} onClose={vi.fn()} onSubmit={onSubmit} />
      );
      await user.type(screen.getByLabelText(/search tasks/i), "other");
      await user.click(screen.getByTestId("dep-suggestion"));
      await user.click(screen.getByRole("button", { name: /save changes/i }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dependencies: ["t2"] }),
        "t1"
      );
    });

    it("should_exclude_removed_dependency_id_from_submitted_draft", async () => {
      const onSubmit = vi.fn();
      const taskWithDep: TaskRecord = { ...mockTask, dependencies: ["t2"] };
      render(
        <EditDrawer open task={taskWithDep} allTasks={[taskWithDep, otherTask]} onClose={vi.fn()} onSubmit={onSubmit} />
      );
      await user.click(screen.getByRole("button", { name: "Remove dependency Other task" }));
      await user.click(screen.getByRole("button", { name: /save changes/i }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dependencies: [] }),
        "t1"
      );
    });

    it("should_block_submit_and_show_inline_error_when_dependencies_would_cycle_at_save", async () => {
      // Simulates a cycle that arrived via realtime sync after the drawer opened:
      // t1 → t2 (this draft) while t2 → t1 (already in the store).
      const onSubmit = vi.fn();
      const blocker: TaskRecord = { ...otherTask, dependencies: ["t1"] };
      const taskWithCycle: TaskRecord = { ...mockTask, dependencies: ["t2"] };
      render(
        <EditDrawer open task={taskWithCycle} allTasks={[taskWithCycle, blocker]} onClose={vi.fn()} onSubmit={onSubmit} />
      );
      await user.click(screen.getByRole("button", { name: /save changes/i }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(/circular dependency/i);
    });

    it("should_submit_dependencies_without_task_id_in_create_mode", async () => {
      const onSubmit = vi.fn();
      render(<EditDrawer open task={null} allTasks={[otherTask]} onClose={vi.fn()} onSubmit={onSubmit} />);
      await user.type(screen.getByLabelText(/title/i), "Brand new task");
      await user.type(screen.getByLabelText(/search tasks/i), "other");
      await user.click(screen.getByTestId("dep-suggestion"));
      await user.click(screen.getByRole("button", { name: /create task/i }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dependencies: ["t2"] }),
        undefined
      );
    });

    it("should_render_without_all_tasks_prop_and_keep_existing_fields_working", () => {
      render(<EditDrawer open task={mockTask} onClose={vi.fn()} onSubmit={vi.fn()} />);
      expect(screen.getByLabelText(/search tasks/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Run tests — verify they fail for the right reason**

Run: `bun run test -- tests/ui/edit-drawer.test.tsx`
Expected: the 5 new tests FAIL (no `allTasks` prop, no dependencies field rendered — `getByLabelText(/search tasks/i)` throws). The pre-existing tests must still PASS.

- [ ] **Step 3: Extend `useEditDraftState`**

In `components/matrix-simplified/use-edit-draft-state.ts`:

Add to the `EditDraftState` interface (after `tags`/`setTags`):

```ts
  dependencies: string[];
  setDependencies: (v: string[]) => void;
```

Add state in the hook body (after the `tags` useState):

```ts
  const [dependencies, setDependencies] = useState<string[]>(() =>
    task ? task.dependencies ?? [] : initialDraft?.dependencies ?? []
  );
```

Add `dependencies,` to the object returned by `toDraft()` and `dependencies, setDependencies,` to the hook's return object.

- [ ] **Step 4: Extend the drawer**

In `components/matrix-simplified/edit-drawer.tsx`:

1. Add `dependencies: string[];` to the `EditDraft` interface.
2. Add to `EditDrawerProps`:

```ts
  /** Full live task list — candidate pool for the dependency picker. */
  allTasks?: TaskRecord[];
```

3. Thread `allTasks` through `EditDrawer` → `EditDrawerForm` (add to both destructures and the JSX pass-through, defaulting at the form: `allTasks = []`).
4. Import `useState` (extend the existing react import) and the new module:

```ts
import { DependenciesField, findDependencyCycleError } from "./edit-drawer-dependencies";
```

5. In `EditDrawerForm`, add error state and a change handler that clears it:

```tsx
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  const handleDependenciesChange = (ids: string[]): void => {
    setDependencyError(null);
    draft.setDependencies(ids);
  };
```

6. Replace the `submit` function with:

```tsx
  const submit = (e?: FormEvent): void => {
    e?.preventDefault();
    if (!draft.title.trim()) return;
    const cycleError = task
      ? findDependencyCycleError(task.id, draft.dependencies, allTasks)
      : null;
    if (cycleError) {
      setDependencyError(cycleError);
      return;
    }
    void onSubmit(draft.toDraft(), task?.id);
  };
```

7. Render the field after `<TagsField … />`:

```tsx
          <DependenciesField
            taskId={task?.id}
            dependencies={draft.dependencies}
            allTasks={allTasks}
            onChange={handleDependenciesChange}
            error={dependencyError}
          />
```

- [ ] **Step 5: Run tests — verify green (new AND pre-existing)**

Run: `bun run test -- tests/ui/edit-drawer.test.tsx tests/ui/edit-drawer-dependencies.test.tsx`
Expected: PASS, zero regressions in the existing drawer tests.

- [ ] **Step 6: Check file sizes stay under the cap**

Run: `wc -l components/matrix-simplified/edit-drawer.tsx components/matrix-simplified/use-edit-draft-state.ts components/matrix-simplified/edit-drawer-dependencies.tsx`
Expected: every file ≤350 lines (drawer lands ~215, hook ~135, field ~190). If any exceeds, split before committing.

- [ ] **Step 7: Commit**

```bash
git add components/matrix-simplified/edit-drawer.tsx components/matrix-simplified/use-edit-draft-state.ts tests/ui/edit-drawer.test.tsx
git commit -m "feat(matrix): wire Depends on field into v9 edit drawer"
```

---

### Task 3: Shell wiring — pass task list, forward dependencies on create

**Files:**
- Modify: `components/matrix-simplified/index.tsx` (`handleEditSubmit` ~line 218-240; both `<EditDrawer …>` instances ~lines 304-315)
- Test: `tests/ui/matrix-simplified.test.tsx` (append one test inside `describe("<MatrixSimplified>")`)

**Interfaces:**
- Consumes: `EditDrawer` `allTasks` prop and `EditDraft.dependencies` (Task 2); `all` from the existing `const { all } = useTasks()` at `index.tsx:132`; mocked `createTask` from the test file's existing `vi.mock("@/lib/tasks", …)`.
- Produces: create path forwards `dependencies: draft.dependencies.length > 0 ? draft.dependencies : undefined` to `createTask` (mirrors the existing `tags` handling). Edit path needs no change — `updateTask(taskId, draft)` already passes the whole draft and `lib/tasks/crud/update.ts:82` merges `dependencies`.

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/matrix-simplified.test.tsx` (model: the existing "opens the create drawer when the shell new-task event fires" test at ~line 201; `tasksFixture`, `makeTask`, and the `@/lib/tasks` mock already exist in this file):

```tsx
  it("passes drawer-selected dependencies to createTask on the create path", async () => {
    const user = userEvent.setup();
    tasksFixture.current = [makeTask({ id: "dep-1", title: "Prepare deck" })];
    render(<MatrixSimplified />);

    act(() => {
      window.dispatchEvent(new CustomEvent("gsd:new-task"));
    });
    await screen.findByRole("heading", { name: /new task/i });

    await user.type(screen.getByLabelText(/title/i), "Present deck");
    await user.type(screen.getByLabelText(/search tasks/i), "prepare");
    await user.click(screen.getByTestId("dep-suggestion"));
    await user.click(screen.getByRole("button", { name: /create task/i }));

    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Present deck", dependencies: ["dep-1"] })
      )
    );
  });
```

- [ ] **Step 2: Run test — verify it fails for the right reason**

Run: `bun run test -- tests/ui/matrix-simplified.test.tsx`
Expected: the new test FAILS at `getByLabelText(/search tasks/i)`-then-suggestion or on the `createTask` payload (no `dependencies` key), because the shell doesn't pass `allTasks` yet. Pre-existing tests still PASS.

- [ ] **Step 3: Implement the wiring**

In `components/matrix-simplified/index.tsx`:

1. Add `allTasks={all}` to **both** `<EditDrawer …>` instances (create-mode and edit-mode, ~lines 304-315). `all` is already in scope from line 132.
2. In `handleEditSubmit`'s create branch, add one line to the `createTask({...})` argument, after `tags`:

```ts
          dependencies: draft.dependencies.length > 0 ? draft.dependencies : undefined,
```

- [ ] **Step 4: Run test — verify green**

Run: `bun run test -- tests/ui/matrix-simplified.test.tsx`
Expected: PASS, zero regressions.

- [ ] **Step 5: Commit**

```bash
git add components/matrix-simplified/index.tsx tests/ui/matrix-simplified.test.tsx
git commit -m "feat(matrix): pass live task list and create-path dependencies through shell"
```

---

### Task 4: Full verification, live-app check, docs, release prep

**Files:**
- Modify: `docs/adr/0011-v9-single-matrix-refactor.md` (append addendum)
- Modify: `package.json` (version bump)
- Modify: `tasks/todo.md` (Resuming From Here)

- [ ] **Step 1: Full test suite + coverage**

Run: `bun run test -- --coverage`
Expected: all tests pass; changed files (`edit-drawer-dependencies.tsx`, `edit-drawer.tsx`, `use-edit-draft-state.ts`, `index.tsx`) each ≥80% statements/lines/functions. Add targeted tests if any changed file falls short.

- [ ] **Step 2: Typecheck + lint**

Run: `bun typecheck && bun lint`
Expected: zero errors (lint may show the pre-existing ~21 warnings on untouched files; no NEW warnings in touched files).

- [ ] **Step 3: Verify in the running app**

Invoke the **`/verify-frontend-change`** skill (mandatory for edited `components/**` files — the service worker serves stale chunks and data surfaces render empty on fresh load, so a naive screenshot lies). Verify at minimum:
1. Seed ≥3 tasks; open one; "Depends on" field renders below Tags.
2. Search, add a dependency, save; reopen → chip persists; the depending task's card shows the "Blocked by 1" badge.
3. Remove the chip, save; badge clears.
4. Create mode (n key → drawer via "More options"): add a dependency during creation; verify persisted.
Let the skill decide whether to codify a Playwright spec for the add→save→badge flow (recommended).

- [ ] **Step 4: a11y + sync review agents**

Dispatch the repo's read-only reviewers on the diff: `a11y-reviewer` (new interactive field) and `pb-sync-reviewer` (ghost-ID preservation touches sync-adjacent write paths). Address any blocking findings before proceeding.

- [ ] **Step 5: ADR addendum**

Append to `docs/adr/0011-v9-single-matrix-refactor.md`:

```markdown
## Addendum (2026-07-05): dependency editing restored

The v8 removal (PR #238) dropped `task-form-dependencies.tsx` with the rest of
the modular task form, leaving the dependency system write-only via MCP/import
while cards still displayed Blocked by/Blocking badges. A "Depends on" field
was restored inside the v9 edit drawer (`edit-drawer-dependencies.tsx`),
reusing `lib/dependencies.ts` cycle detection. Subtask editing remains
drawer-less; `restoreTask` still does not restore inbound dependency edges
(tracked in tasks/todo.md).
```

- [ ] **Step 6: Version bump**

In `package.json`, bump the minor version (feature): current `9.x.y` → `9.(x+1).0`.

- [ ] **Step 7: Update tasks/todo.md**

Append a "Resuming From Here" entry: feature complete, spec/plan references, deferred follow-ups (subtask editing restoration; `restoreTask` inbound-edge fix).

- [ ] **Step 8: Commit, push, PR**

Invoke the **`commit-commands:commit-push-pr`** skill for the final commit + push + PR (repo convention). PR body: what changed (restored dependency-linking UI in v9 drawer), why (feature lost in #238; data layer was intact), how to test (steps from Step 3), out-of-scope follow-ups, and the spec/plan file paths.

- [ ] **Step 9: Comprehension gate (Non-trivial tier)**

Generate the change report + 5–10 question quiz per coding-standards Part 1 Phase 3 before merge.

---

## Self-Review (completed at authoring time)

- **Spec coverage:** AC1→T1S2, AC2→T1S7+T2S1, AC3→T1S7, AC4→T1S9+T2S1, AC5→T1S9, AC6→T1S9+T2S1+T3S1, AC7→T1S2+T2S1, AC8→T1S9, AC9→T1S9+T2S1. Edge cases 1–9 covered by the same tests; edge case 10 (no migration) is a non-action.
- **Placeholder scan:** none — all steps carry full code/commands.
- **Type consistency:** `DependenciesField` prop names (`taskId`, `dependencies`, `allTasks`, `onChange`, `error`) and `findDependencyCycleError(taskId, dependencies, allTasks)` are identical across Tasks 1, 2; `EditDraft.dependencies: string[]` and `allTasks?: TaskRecord[]` identical across Tasks 2, 3.
