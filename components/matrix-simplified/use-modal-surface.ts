"use client";

import { useEffect, useRef } from "react";

/**
 * Behaviour shared by any hand-rolled modal surface: the page behind is frozen,
 * and the backdrop dismisses only when the gesture *began* there.
 *
 * Both exist for the same reason. Scrolling past the end of the drawer otherwise
 * chains to the document and moves the page underneath — dragging the anchored
 * field out from under a viewport-positioned popup, and making a drag-release
 * land somewhere the user never intended. A plain backdrop `onClick` then reads
 * that release as a dismissal and silently discards an in-progress edit.
 */
export function useModalSurface(onClose: () => void) {
  const startedOnBackdrop = useRef(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return {
    onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
      startedOnBackdrop.current = event.target === event.currentTarget;
    },
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget && startedOnBackdrop.current) onClose();
    },
  };
}
