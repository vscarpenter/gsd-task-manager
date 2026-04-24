/**
 * Layering scale for the entire UI.
 *
 * Use these constants instead of raw numbers so the stacking order is
 * discoverable in one place and stays consistent as new layers are added.
 * Tailwind utilities (`z-30`, etc.) used in JSX should match these values.
 */
export const Z = {
  base: 1,
  canvasLabel: 2,
  hover: 10,
  dragging: 20,
  sticky: 30,
  overlay: 40,
  modal: 50,
} as const;

export type ZLayer = keyof typeof Z;
