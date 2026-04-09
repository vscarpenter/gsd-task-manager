import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

/** Sortable attributes from useSortable hook */
export type SortableAttributes = DraggableAttributes;

/** Sortable listeners from useSortable hook */
export type SortableListeners = SyntheticListenerMap | undefined;
