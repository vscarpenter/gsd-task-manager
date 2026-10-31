import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ESCALATION_WINDOW_DAYS,
  ESCALATION_WINDOW_KEY,
  readEscalationWindow,
  writeEscalationWindow,
} from "@/lib/preferences/escalation-window";

describe("escalation window preference", () => {
  beforeEach(() => {
    window.localStorage.removeItem(ESCALATION_WINDOW_KEY);
  });

  it("defaults to 2 days when nothing is stored", () => {
    expect(readEscalationWindow()).toBe(2);
    expect(DEFAULT_ESCALATION_WINDOW_DAYS).toBe(2);
  });

  it.each([1, 2, 3, 7])("round-trips %i days", (days) => {
    writeEscalationWindow(days);
    expect(readEscalationWindow()).toBe(days);
  });

  it("round-trips Off as null", () => {
    writeEscalationWindow(null);
    expect(readEscalationWindow()).toBeNull();
  });

  it.each(["", "abc", "0", "4", "-1", "2.5", "null"])(
    "falls back to 2 for the unknown stored value %j",
    (stored) => {
      window.localStorage.setItem(ESCALATION_WINDOW_KEY, stored);
      expect(readEscalationWindow()).toBe(2);
    }
  );
});
