import { describe, expect, it } from "vitest";
import { escalationLabel } from "@/lib/escalation";

describe("escalationLabel", () => {
  it.each([
    [-3, "Escalating: 3 days overdue, not marked urgent."],
    [-1, "Escalating: 1 day overdue, not marked urgent."],
    [0, "Escalating: due today, not marked urgent."],
    [1, "Escalating: due tomorrow, not marked urgent."],
    [2, "Escalating: due in 2 days, not marked urgent."],
    [7, "Escalating: due in 7 days, not marked urgent."],
  ])("reads %i days as %j", (days, expected) => {
    expect(escalationLabel(days)).toBe(expected);
  });
});
