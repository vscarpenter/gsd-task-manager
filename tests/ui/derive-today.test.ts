import { describe, expect, it } from "vitest";
import { deriveToday } from "@/components/today-strip/derive-today";
import { createMockTask } from "@/tests/fixtures";

const ZONE = "America/Chicago";
const NOW = new Date("2026-11-08T16:00:00.000Z"); // Sunday 10:00 in Chicago

const q1 = (id: string, extra = {}) => createMockTask({ id, urgent: true, important: true, ...extra });

describe("deriveToday", () => {
  it("lists picks in rank order with the count the section names", () => {
    const view = deriveToday(
      [q1("b", { focusDate: "2026-11-08", focusRank: 2 }), q1("a", { focusDate: "2026-11-08", focusRank: 1 })],
      NOW, 2, ZONE
    );

    expect(view.picks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(view.hasFreeSlot).toBe(true);
  });

  it("offers carry-over only while a slot is free, labelled From yesterday", () => {
    const tasks = [q1("old", { focusDate: "2026-11-07", focusRank: 1 })];

    const view = deriveToday(tasks, NOW, 2, ZONE);

    expect(view.carry).toEqual({ label: "From yesterday", tasks: [expect.objectContaining({ id: "old" })] });
  });

  it("names the weekday when the carry-over is older than yesterday", () => {
    const view = deriveToday([q1("old", { focusDate: "2026-11-06", focusRank: 1 })], NOW, 2, ZONE);

    expect(view.carry.label).toBe("From Friday");
  });

  it("hides carry-over when today is full", () => {
    const tasks = [
      q1("a", { focusDate: "2026-11-08", focusRank: 1 }),
      q1("b", { focusDate: "2026-11-08", focusRank: 2 }),
      q1("c", { focusDate: "2026-11-08", focusRank: 3 }),
      q1("old", { focusDate: "2026-11-07", focusRank: 1 }),
    ];

    expect(deriveToday(tasks, NOW, 2, ZONE).carry.tasks).toEqual([]);
  });

  it("suggests the first three, leaving out what carry-over already offers", () => {
    const tasks = [
      q1("old", { focusDate: "2026-11-07", focusRank: 1 }),
      q1("s1", { createdAt: "2026-11-01T00:00:00.000Z" }),
      q1("s2", { createdAt: "2026-11-02T00:00:00.000Z" }),
      q1("s3", { createdAt: "2026-11-03T00:00:00.000Z" }),
      q1("s4", { createdAt: "2026-11-04T00:00:00.000Z" }),
    ];

    const view = deriveToday(tasks, NOW, 2, ZONE);

    expect(view.suggestions.map((t) => t.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("flags two devices picking for today", () => {
    const tasks = [
      q1("a", { focusDate: "2026-11-08", focusRank: 1 }),
      q1("b", { focusDate: "2026-11-08", focusRank: 1 }),
    ];

    expect(deriveToday(tasks, NOW, 2, ZONE).needsTidy).toBe(true);
  });
});
