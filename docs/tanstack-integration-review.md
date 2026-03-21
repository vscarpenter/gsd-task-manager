# TanStack Integration Review for GSD Task Manager

**Date:** 2026-03-21
**Reviewer:** Claude Code
**Codebase Version:** 7.3.0

---

## Executive Summary

After analyzing the GSD Task Manager codebase and evaluating the TanStack ecosystem, I identified **three TanStack libraries** with meaningful integration potential, ranked by impact-to-effort ratio. The app's architecture — a client-only PWA with IndexedDB (Dexie) as the primary data store and PocketBase for optional cloud sync — shapes which TanStack tools are a good fit and which are not.

---

## TanStack Libraries Evaluated

| Library | Verdict | Impact | Effort |
|---------|---------|--------|--------|
| **TanStack Virtual** | **Strong fit** | High | Low |
| **TanStack Query** | **Good fit** (sync layer only) | Medium-High | Medium |
| **TanStack Form** | **Moderate fit** | Medium | Medium |
| **TanStack Table** | **Low fit** | Low | Medium |
| **TanStack Router** | **Not applicable** | N/A | High |
| **TanStack Store** | **Not needed** | Low | Low |

---

## 1. TanStack Virtual — **Recommended (High Priority)**

### What it does
Headless virtualization library that only renders visible items in long lists, dramatically improving performance for large datasets.

### Where it fits in GSD

**Archive page** (`app/(archive)/archive/page.tsx`):
- Currently renders ALL archived tasks in a flat grid with no virtualization (line 121-155)
- As tasks accumulate over time, this page will degrade in performance
- Each task renders a full `<TaskCard>` with hover overlays, icons, and action buttons

**Matrix columns** (`components/matrix-column.tsx`):
- Each quadrant renders all its tasks without virtualization
- Power users with 50+ tasks per quadrant will see jank during scrolling
- The component already uses `memo()` which helps, but doesn't solve DOM bloat

**Sync history page** (`app/(sync)/sync-history/page.tsx`):
- Displays sync operation logs which grow unbounded over time

### Current pain points
```
// archive/page.tsx:121 — renders entire list
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {archivedTasks.map((task) => (
    <div key={task.id} className="relative group">
      <TaskCard ... />
    </div>
  ))}
</div>
```

### What the integration would look like
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// In ArchivePage:
const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: archivedTasks.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 180, // estimated card height
});

// Render only visible items
<div ref={parentRef} style={{ overflow: 'auto', height: '80vh' }}>
  <div style={{ height: virtualizer.getTotalSize() }}>
    {virtualizer.getVirtualItems().map((virtualRow) => {
      const task = archivedTasks[virtualRow.index];
      return <TaskCard key={task.id} task={task} ... />;
    })}
  </div>
</div>
```

### Impact
- **Performance**: Renders ~10-20 DOM nodes instead of hundreds/thousands
- **Memory**: Significant reduction in memory usage for large archives
- **Bundle size**: ~3KB gzipped — minimal cost
- **Risk**: Low — purely additive, no data layer changes

---

## 2. TanStack Query — **Recommended (Medium Priority)**

### What it does
Async state management library for server state: caching, background refetching, optimistic updates, retry logic, and stale-while-revalidate patterns.

### Where it fits in GSD

**Important caveat:** The primary data layer uses Dexie `useLiveQuery` for local IndexedDB reads. TanStack Query should **not** replace this — Dexie's live queries are perfect for local-first reactivity. However, TanStack Query is a strong fit for the **PocketBase sync layer**.

**Current sync pain points:**

1. **Manual retry logic** (`lib/sync/retry-manager.ts`): The codebase has a custom `RetryManager` with exponential backoff, circuit breaker patterns, and failure tracking. TanStack Query provides all of this out of the box.

2. **Manual cache management** (`lib/sync/pb-sync-engine.ts:46-58`): `fetchRemoteTaskIndex()` fetches all remote task IDs to build a lookup cache. TanStack Query's built-in caching with configurable `staleTime` and `gcTime` would handle this automatically.

3. **Loading/error state tracking**: The archive page (`app/(archive)/archive/page.tsx:14-15`) manually tracks `isLoading` state with `useState`. TanStack Query provides `isLoading`, `isError`, `error`, `isRefetching` for free.

4. **Background refetching**: The sync coordinator (`lib/sync/sync-coordinator.ts`) implements periodic sync with manual timers. TanStack Query's `refetchInterval` does this declaratively.

5. **Optimistic updates**: Task mutations that sync to PocketBase could use TanStack Query's `onMutate` / `onError` rollback pattern instead of the current manual approach.

### Specific integration points

| Current Code | TanStack Query Replacement |
|-------------|---------------------------|
| `lib/sync/retry-manager.ts` (~180 lines) | `retry: 3, retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)` |
| `lib/archive.ts` manual fetch + state | `useQuery({ queryKey: ['archivedTasks'], queryFn: listArchivedTasks })` |
| `lib/sync/pb-sync-engine.ts` remote index cache | `useQuery({ queryKey: ['remoteTaskIndex'], staleTime: 30_000 })` |
| Manual `isLoading`/`setIsLoading` patterns | Automatic from `useQuery` return value |
| Periodic sync timer in coordinator | `refetchInterval: 120_000` (2 minutes) |

### What it would NOT replace
- `useLiveQuery` in `use-tasks.ts` — this is local IndexedDB reactivity and should stay as-is
- The Dexie data layer — TanStack Query is for server state, not local state

### Impact
- **Code reduction**: Could eliminate ~300-400 lines of custom retry/cache/loading logic
- **Reliability**: Battle-tested retry, caching, and deduplication logic
- **DevTools**: TanStack Query DevTools provide visibility into cache state, queries, and mutations
- **Bundle size**: ~13KB gzipped
- **Risk**: Medium — requires careful integration to avoid conflicting with Dexie live queries

---

## 3. TanStack Form — **Worth Considering**

### What it does
Headless form state management with built-in validation, field-level reactivity, and framework adapters.

### Where it fits in GSD

The task form (`components/task-form/`) currently uses a custom `useTaskForm` hook (138 lines) with:
- Manual `useState` for form values, errors, and submission state
- Manual `updateField` helper for individual field updates
- Custom Zod validation integration in `handleSubmit`
- Manual error parsing from `ZodError` to field-level errors

### Current approach vs TanStack Form

**Current** (`components/task-form/use-task-form.ts`):
```ts
const [values, setValues] = useState<TaskDraft>({...});
const [errors, setErrors] = useState<FormErrors>({});
const [submitting, setSubmitting] = useState(false);

const updateField = <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => {
  setValues((current) => ({ ...current, [key]: value }));
};
```

**With TanStack Form:**
```tsx
const form = useForm({
  defaultValues: initialValues,
  onSubmit: async ({ value }) => {
    const validated = taskDraftSchema.parse(value);
    await onSubmit(validated);
  },
  validators: {
    onChange: taskDraftSchema,
  },
});
```

### Benefits
- **Field-level validation**: Currently validation only runs on submit; TanStack Form supports `onChange`, `onBlur`, and async validators per-field
- **Fewer re-renders**: Only re-renders fields that changed, not the entire form
- **Built-in Zod adapter**: `@tanstack/zod-form-adapter` integrates directly with existing Zod schemas
- **Subtask/dependency arrays**: TanStack Form has first-class support for dynamic field arrays (subtasks, tags, dependencies)

### Why "worth considering" instead of "recommended"
- The current form hook works well and is only 138 lines
- The task form is the only significant form in the app
- The integration would touch UI components (field binding syntax changes)
- Marginal benefit unless more forms are planned

### Impact
- **DX**: Cleaner form code, especially for the complex task form with nested arrays
- **Validation UX**: Enable real-time field validation without custom code
- **Bundle size**: ~8KB gzipped
- **Risk**: Low-Medium — requires refactoring form bindings but no data layer changes

---

## 4. TanStack Table — **Low Priority**

### Why it's a low fit
The app uses an **Eisenhower matrix layout** (2x2 grid of quadrants), not traditional tables. Task display is card-based with drag-and-drop via `@dnd-kit`. The archive page uses a card grid. The dashboard uses chart components.

There is **no tabular data display** in the app. TanStack Table excels at sortable/filterable/paginated tables, but the GSD app's UI paradigm is fundamentally different.

**One potential use**: If a "list view" of all tasks were ever added (e.g., a flat sortable/filterable table), TanStack Table would be the right choice. But this doesn't exist today.

---

## 5. TanStack Router — **Not Applicable**

The app uses **Next.js 16 App Router** for routing. TanStack Router is an alternative to React Router / Next.js routing, not a complement to it. Switching would require a complete architecture change away from Next.js, which is not warranted.

---

## 6. TanStack Store — **Not Needed**

TanStack Store is a lightweight reactive state management library. The app already has:
- React `useState` / `useRef` for component state
- Dexie `useLiveQuery` for reactive database queries
- `next-themes` for theme state
- Custom event-based communication (e.g., `useToggleCompletedListener`)

There's no gap that TanStack Store would fill better than what's already in place.

---

## Recommended Implementation Order

### Phase 1: TanStack Virtual (Low effort, high impact)
1. Install `@tanstack/react-virtual`
2. Add virtualization to the Archive page
3. Add virtualization to Matrix columns (for users with many tasks)
4. Add virtualization to sync history page

### Phase 2: TanStack Query (Medium effort, medium-high impact)
1. Install `@tanstack/react-query` and `@tanstack/react-query-devtools`
2. Add `QueryClientProvider` to the app layout
3. Migrate archive page data fetching to `useQuery`
4. Wrap PocketBase sync operations in `useMutation` with optimistic updates
5. Replace custom retry manager with TanStack Query's built-in retry
6. Optionally add Query DevTools for development

### Phase 3: TanStack Form (Optional, medium effort)
1. Install `@tanstack/react-form` and `@tanstack/zod-form-adapter`
2. Refactor `useTaskForm` hook to use TanStack Form
3. Add field-level validation for better UX
4. Simplify subtask/tag/dependency array management

---

## Key Files That Would Be Modified

| File | Phase | Change |
|------|-------|--------|
| `package.json` | 1, 2, 3 | Add TanStack dependencies |
| `app/(archive)/archive/page.tsx` | 1, 2 | Virtualization + useQuery |
| `components/matrix-column.tsx` | 1 | Virtualization for large lists |
| `app/(sync)/sync-history/page.tsx` | 1 | Virtualization for logs |
| `app/layout.tsx` | 2 | Add QueryClientProvider |
| `lib/sync/retry-manager.ts` | 2 | Could be replaced entirely |
| `lib/sync/pb-sync-engine.ts` | 2 | Use useMutation for push/pull |
| `components/task-form/use-task-form.ts` | 3 | Refactor to TanStack Form |
| `components/task-form/index.tsx` | 3 | Update field bindings |

---

## Risks and Considerations

1. **Bundle size**: All three phases add ~24KB gzipped total. For a PWA that works offline, this is acceptable but worth monitoring.

2. **Dexie coexistence**: TanStack Query must complement Dexie, not compete with it. The local-first reads via `useLiveQuery` should remain unchanged. TanStack Query should only manage server-state (PocketBase sync).

3. **Testing**: The existing test suite (`tests/ui/`, `tests/data/`) would need updates, particularly for components using new hooks. TanStack provides testing utilities (`@tanstack/react-query` has a `QueryClientProvider` wrapper for tests).

4. **PWA/Offline**: TanStack Query handles offline scenarios well (`networkMode: 'offlineFirst'`), which aligns perfectly with the PWA architecture.
