import { describe, expect, it } from "vitest";

import {
  DESIGN_DIRECTIONS,
  DESIGN_TASKS,
  type DesignPalette,
} from "@/components/design-lab/design-data";

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function expectPaletteToMeetAa(palette: DesignPalette): void {
  expect(contrast(palette.text, palette.canvas)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.text, palette.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.muted, palette.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.accentText, palette.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.focus, palette.surface)).toBeGreaterThanOrEqual(3);
  expect(contrast(palette.line, palette.surface)).toBeGreaterThanOrEqual(3);
}

describe("design-lab comparison contract", () => {
  it("defines five distinct directions across more than palette", () => {
    expect(DESIGN_DIRECTIONS).toHaveLength(5);
    expect(new Set(DESIGN_DIRECTIONS.map((direction) => direction.slug)).size).toBe(5);
    expect(new Set(DESIGN_DIRECTIONS.map((direction) => direction.typeStrategy)).size).toBe(5);
    expect(new Set(DESIGN_DIRECTIONS.map((direction) => direction.navigationModel)).size).toBe(5);
    expect(new Set(DESIGN_DIRECTIONS.map((direction) => direction.matrixModel)).size).toBe(5);
    expect(new Set(DESIGN_DIRECTIONS.map((direction) => direction.light.accent)).size).toBe(5);
  });

  it("keeps every light and dark palette at the requested contrast floor", () => {
    for (const direction of DESIGN_DIRECTIONS) {
      expectPaletteToMeetAa(direction.light);
      expectPaletteToMeetAa(direction.dark);
    }
  });

  it("uses one realistic dataset with every required task state", () => {
    const quadrantCounts = new Map<string, number>();
    for (const task of DESIGN_TASKS) {
      quadrantCounts.set(task.quadrant, (quadrantCounts.get(task.quadrant) ?? 0) + 1);
    }

    expect(DESIGN_TASKS).toHaveLength(12);
    expect([...quadrantCounts.values()]).toEqual([3, 3, 3, 3]);
    expect(DESIGN_TASKS.some((task) => task.dueTone === "today")).toBe(true);
    expect(DESIGN_TASKS.some((task) => task.dueTone === "overdue")).toBe(true);
    expect(DESIGN_TASKS.some((task) => task.recurrence)).toBe(true);
    expect(DESIGN_TASKS.some((task) => task.tags.length > 0)).toBe(true);
    expect(DESIGN_TASKS.some((task) => task.subtasks && task.subtasks.total > 0)).toBe(true);
    expect(DESIGN_TASKS.some((task) => task.dependency)).toBe(true);
    expect(DESIGN_TASKS.some((task) => task.completed)).toBe(true);
    expect(DESIGN_TASKS.some((task) => task.title.length > 64)).toBe(true);
  });
});
