/**
 * Matrix Board - Main task management component
 *
 * This file re-exports the MatrixBoard component from its modular implementation.
 * The component has been split into focused modules for better maintainability:
 * - components/matrix-board/index.tsx - Main component with rendering logic
 * - components/matrix-board/use-bulk-selection.ts - Bulk selection state and operations
 * - components/matrix-board/use-task-operations.ts - Task CRUD operations
 */

export { MatrixBoard } from "./matrix-board/index";
