# 0008: BFS Algorithm for Circular Dependency Detection

**Date:** 2026-04-14
**Status:** Accepted
**Deciders:** Vinny Carpenter

## Context

Tasks can declare dependencies on other tasks (e.g., "Task B cannot start until Task A is done"). This forms a directed graph. If a cycle is introduced — Task A depends on B, B depends on C, C depends on A — the dependency system becomes logically inconsistent and any cycle-traversal code risks infinite loops. The app must validate that adding a dependency edge would not create a cycle before persisting it.

## Decision

Implement cycle detection using an iterative Breadth-First Search (BFS) algorithm in `lib/dependencies.ts`, exported as `wouldCreateCircularDependency(taskId, newDependencyId, allTasks)`. Before adding any dependency, the function performs a BFS traversal starting from `newDependencyId`, following existing dependency edges. If `taskId` is encountered during the traversal, the proposed edge would create a cycle and the operation is rejected. The algorithm is iterative (using an explicit queue) rather than recursive.

BFS was chosen over DFS for the following reasons:
- **No call stack risk**: Iterative BFS uses a heap-allocated queue; deep or wide graphs do not risk stack overflow. A recursive DFS with hundreds of chained tasks could overflow the JavaScript call stack.
- **Early termination**: BFS visits nodes level-by-level and can short-circuit as soon as the source node is found.
- **Simpler iterative implementation**: An explicit queue is easier to reason about and debug than managing a DFS recursion stack with visited/active sets.

All dependency mutations (`addDependency`, `removeDependency`) go through `lib/tasks/dependencies.ts`, which calls `wouldCreateCircularDependency()` before writing to IndexedDB. The MCP server's write tools also invoke this validation in dry-run and live modes.

## Consequences

### Easier
- Cycle detection is safe for arbitrarily large dependency graphs with no stack overflow risk.
- A single, well-tested function in `lib/dependencies.ts` is the authoritative gate for all dependency writes.
- BFS is easy to unit test with small graph fixtures covering no-cycle, direct cycle, and indirect cycle cases.
- The iterative implementation is straightforward to audit for correctness.

### Harder
- BFS runs on every dependency-add operation; for very large graphs (hundreds of tasks with many dependencies) this could be noticeable, though in practice task graphs are small.
- The full task list must be passed into the function, meaning the caller is responsible for fetching all tasks from IndexedDB before calling the validator.
- Removing a dependency requires a separate `removeDependencyReferences()` cleanup pass to purge stale IDs from all tasks that referenced the deleted task.

## Alternatives Considered

- **Recursive DFS**: Standard cycle detection approach in graph theory. Rejected due to JavaScript's limited call stack depth — a chain of ~10,000 dependent tasks would throw a `RangeError: Maximum call stack size exceeded`. BFS avoids this entirely.
- **Topological sort (Kahn's algorithm)**: Would detect cycles as a side effect of sorting the entire graph. Overkill — we only need to check whether one new edge creates a cycle, not sort all tasks. Adds unnecessary complexity.
- **Trust users not to create cycles**: Simpler implementation, but any cycle in the graph would cause infinite loops in any feature that traverses dependencies (e.g., blocking task display, MCP analytics). Rejected — correctness is non-negotiable here.
- **Server-side validation**: Cycle detection could be delegated to PocketBase via a custom hook. Rejected — the app must work offline (ADR-0001), so validation must be fully client-side.
