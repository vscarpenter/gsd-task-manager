"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  beginSwipe,
  endSwipe,
  LEADING_REVEAL,
  TRAILING_REVEAL,
  trackSwipe,
  type SwipeDrag,
  type SwipeOutcome,
} from "@/lib/swipe-gesture";

// One open row across the whole board, the way iOS's swipeActionsContainer
// keeps one row open: opening a second row closes the first. A module-level
// store rather than context, so the matrix does not re-render on every swipe.
let openRowId: string | null = null;
const listeners = new Set<() => void>();

function subscribeOpenRow(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readOpenRowId(): string | null {
  return openRowId;
}

function readOpenRowIdOnServer(): null {
  return null;
}

function setOpenRowId(id: string | null): void {
  if (openRowId === id) return;
  openRowId = id;
  for (const listener of listeners) listener();
}

type SurfacePointerEvent = PointerEvent<HTMLElement>;

/** What the pointer handlers need from the hook's state. */
interface SwipeMachine {
  drag: RefObject<SwipeDrag | null>;
  shown: number;
  setOffset: (offset: number) => void;
  setDragging: (dragging: boolean) => void;
  settle: (outcome: SwipeOutcome) => void;
  close: () => void;
}

/** Only a primary touch pointer starts a swipe; mouse and pen never do. */
function pointerDown(machine: SwipeMachine, event: SurfacePointerEvent): void {
  if (event.pointerType !== "touch" || !event.isPrimary) return;
  const rowWidth = event.currentTarget.getBoundingClientRect().width;
  machine.drag.current = beginSwipe(event, machine.shown, rowWidth);
}

function pointerMove(machine: SwipeMachine, event: SurfacePointerEvent): void {
  const drag = machine.drag.current;
  if (!drag || event.pointerId !== drag.pointerId) return;
  const next = trackSwipe(drag, event);
  if (next.axis === "vertical") {
    // The scroller owns this one.
    machine.drag.current = null;
    return;
  }
  if (next.axis === "undecided") return;
  if (drag.axis !== "horizontal") {
    drag.axis = "horizontal";
    capturePointer(event);
    machine.setDragging(true);
  }
  machine.setOffset(next.offset);
}

/**
 * Keep samples flowing to the surface even when the finger leaves it. Capture is
 * a nicety, not the gesture: a pointer that is no longer active (released between
 * samples, or a synthetic event) makes Firefox throw NotFoundError, and the drag
 * still tracks without it.
 */
function capturePointer(event: SurfacePointerEvent): void {
  const target = event.currentTarget;
  if (typeof target.setPointerCapture !== "function") return;
  try {
    target.setPointerCapture(event.pointerId);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
  }
}

function pointerEnd(machine: SwipeMachine, event: SurfacePointerEvent): void {
  const drag = machine.drag.current;
  if (!drag || event.pointerId !== drag.pointerId) return;
  machine.drag.current = null;
  if (drag.axis !== "horizontal") return;
  machine.setDragging(false);
  machine.settle(endSwipe(drag, event));
}

/** While open, a tap anywhere on the card closes it instead of reaching the card's controls. */
function clickCapture(machine: SwipeMachine, event: MouseEvent<HTMLElement>): void {
  if (machine.shown === 0) return;
  event.preventDefault();
  event.stopPropagation();
  machine.close();
}

export interface SwipeSurfaceProps {
  onPointerDown: (event: SurfacePointerEvent) => void;
  onPointerMove: (event: SurfacePointerEvent) => void;
  onPointerUp: (event: SurfacePointerEvent) => void;
  onPointerCancel: (event: SurfacePointerEvent) => void;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

export interface SwipeGesture {
  /** Horizontal offset of the card, in pixels. Positive reveals the leading edge. */
  shown: number;
  /** True while a finger is moving the card, so the snap transition stays off. */
  dragging: boolean;
  close: () => void;
  surfaceProps: SwipeSurfaceProps;
}

/**
 * Touch-only swipe handling for one card. Vertical-dominant drags release to
 * the scroller; horizontal ones claim the pointer and move the card.
 */
export function useSwipeGesture(rowId: string, onCommitLeading: () => void): SwipeGesture {
  const drag = useRef<SwipeDrag | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const openId = useSyncExternalStore(subscribeOpenRow, readOpenRowId, readOpenRowIdOnServer);
  // A row that lost "open" to a sibling renders closed, with no effect needed.
  const shown = dragging || openId === rowId ? offset : 0;

  const close = () => {
    setOffset(0);
    if (readOpenRowId() === rowId) setOpenRowId(null);
  };

  const settle = (outcome: SwipeOutcome) => {
    if (outcome === "close" || outcome === "commit-leading") {
      close();
      if (outcome === "commit-leading") onCommitLeading();
      return;
    }
    setOffset(outcome === "open-leading" ? LEADING_REVEAL : -TRAILING_REVEAL);
    setOpenRowId(rowId);
  };

  const machine: SwipeMachine = { drag, shown, setOffset, setDragging, settle, close };
  return {
    shown,
    dragging,
    close,
    surfaceProps: {
      onPointerDown: (event) => pointerDown(machine, event),
      onPointerMove: (event) => pointerMove(machine, event),
      onPointerUp: (event) => pointerEnd(machine, event),
      onPointerCancel: (event) => pointerEnd(machine, event),
      onClickCapture: (event) => clickCapture(machine, event),
    },
  };
}
