/**
 * Smart View icon registry.
 *
 * `SmartView.icon` is a free-form string on the persisted record, so custom
 * views created before this registry existed may still carry a raw glyph. The
 * built-ins name a key here instead: the matrix draws all of its chrome with
 * Lucide, and a pictograph in the middle of that set reads as a different
 * product (PRODUCT.md anti-reference: "a gamified todo toy").
 *
 * Consumers index this map directly and fall back to rendering the raw string
 * when it isn't a known key, so legacy custom icons keep working. Index it
 * inline rather than wrapping it in a resolver: react-hooks/static-components
 * cannot see through a function boundary and flags the returned component as
 * one created during render.
 */

import {
  AlertTriangleIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CalendarOffIcon,
  CircleCheckIcon,
  CirclePlusIcon,
  FlameIcon,
  PlayIcon,
  RepeatIcon,
  type LucideIcon,
} from "lucide-react";

export const SMART_VIEW_ICONS = {
  // Mirrors the Q1 pane glyph — this view *is* the urgent-and-important
  // quadrant, so reusing its mark ties the filter to the matrix it filters.
  flame: FlameIcon,
  calendar: CalendarDaysIcon,
  overdue: AlertTriangleIcon,
  "no-deadline": CalendarOffIcon,
  added: CirclePlusIcon,
  "completed-recent": CalendarCheckIcon,
  completed: CircleCheckIcon,
  recurring: RepeatIcon,
  ready: PlayIcon,
} as const satisfies Record<string, LucideIcon>;

export type SmartViewIconKey = keyof typeof SMART_VIEW_ICONS;
