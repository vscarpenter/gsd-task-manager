import { describe, expect, it } from "vitest";
import { isImeComposing } from "@/lib/ime";

describe("isImeComposing", () => {
  it("reports composition while the native event is composing", () => {
    const event = new KeyboardEvent("keydown", { key: "Enter", isComposing: true });

    expect(isImeComposing(event)).toBe(true);
  });

  it("reports composition for the keyCode 229 Enter Safari sends after compositionend", () => {
    const event = new KeyboardEvent("keydown", { key: "Enter", keyCode: 229 });

    expect(isImeComposing(event)).toBe(true);
  });

  it("treats an ordinary Enter as not composing", () => {
    const event = new KeyboardEvent("keydown", { key: "Enter", keyCode: 13 });

    expect(isImeComposing(event)).toBe(false);
  });
});
