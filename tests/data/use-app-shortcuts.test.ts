import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useAppShortcuts,
  type AppShortcutHandlers,
} from "@/lib/use-app-shortcuts";

const handlers: AppShortcutHandlers = {
  onSearch: vi.fn(),
  onCapture: vi.fn(),
  onReview: vi.fn(),
  onFocusQuadrant: vi.fn(),
};

function press(
  code: string,
  init: KeyboardEventInit = {},
  target: HTMLElement | Window = window
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    code,
    key: "Dead",
    altKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe("useAppShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("maps exact Option-alone physical codes and prevents their browser defaults", () => {
    renderHook(() => useAppShortcuts(handlers));

    const search = press("Slash", { key: "÷" });
    const capture = press("KeyN", { key: "˜" });
    const review = press("KeyR", { key: "®" });
    const quadrantEvents = ["Digit1", "Digit2", "Digit3", "Digit4"].map(
      (code) => press(code)
    );

    expect(handlers.onSearch).toHaveBeenCalledOnce();
    expect(handlers.onCapture).toHaveBeenCalledOnce();
    expect(handlers.onReview).toHaveBeenCalledOnce();
    expect(handlers.onFocusQuadrant).toHaveBeenNthCalledWith(1, "q1");
    expect(handlers.onFocusQuadrant).toHaveBeenNthCalledWith(2, "q2");
    expect(handlers.onFocusQuadrant).toHaveBeenNthCalledWith(3, "q3");
    expect(handlers.onFocusQuadrant).toHaveBeenNthCalledWith(4, "q4");
    expect([search, capture, review, ...quadrantEvents].every((event) => event.defaultPrevented)).toBe(true);
  });

  it.each([
    ["without Option", { altKey: false }],
    ["with Command", { metaKey: true }],
    ["with Control", { ctrlKey: true }],
    ["with Shift", { shiftKey: true }],
    ["while repeating", { repeat: true }],
    ["while composing", { isComposing: true }],
  ])("ignores a mapped code %s", (_label, init) => {
    renderHook(() => useAppShortcuts(handlers));

    const event = press("KeyN", init);

    expect(handlers.onCapture).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores events already handled by another listener", () => {
    renderHook(() => useAppShortcuts(handlers));
    const event = new KeyboardEvent("keydown", {
      code: "KeyR",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();

    window.dispatchEvent(event);

    expect(handlers.onReview).not.toHaveBeenCalled();
  });

  it.each(["input", "textarea", "select"])(
    "ignores mapped shortcuts from a %s",
    (tagName) => {
      renderHook(() => useAppShortcuts(handlers));
      const target = document.createElement(tagName);
      document.body.appendChild(target);

      const event = press("Slash", {}, target);

      expect(handlers.onSearch).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    }
  );

  it("ignores a descendant of a contenteditable region", () => {
    renderHook(() => useAppShortcuts(handlers));
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    const child = document.createElement("span");
    editable.appendChild(child);
    document.body.appendChild(editable);

    const event = press("Digit2", {}, child);

    expect(handlers.onFocusQuadrant).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores shortcuts while an aria-modal dialog is open", () => {
    renderHook(() => useAppShortcuts(handlers));
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    const event = press("KeyR");

    expect(handlers.onReview).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does not prevent Option combinations it does not own", () => {
    renderHook(() => useAppShortcuts(handlers));

    const event = press("KeyX");

    expect(Object.values(handlers).every((handler) => !handler.mock.calls.length)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });
});
