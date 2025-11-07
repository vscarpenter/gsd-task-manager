import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

describe("useKeyboardShortcuts", () => {
  const mockHandlers = {
    onNewTask: vi.fn(),
    onSearch: vi.fn(),
    onHelp: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onNewTask when 'n' is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "n" });
    window.dispatchEvent(event);

    expect(mockHandlers.onNewTask).toHaveBeenCalledOnce();
  });

  it("calls onNewTask when 'N' is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "N" });
    window.dispatchEvent(event);

    expect(mockHandlers.onNewTask).toHaveBeenCalledOnce();
  });

  it("calls onSearch when '/' is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "/" });
    window.dispatchEvent(event);

    expect(mockHandlers.onSearch).toHaveBeenCalledOnce();
  });

  it("calls onHelp when '?' is pressed", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", { key: "?" });
    window.dispatchEvent(event);

    expect(mockHandlers.onHelp).toHaveBeenCalledOnce();
  });

  it("focuses search input when provided and '/' pressed", () => {
    const mockInput = document.createElement("input");
    const focusSpy = vi.spyOn(mockInput, "focus");
    const searchInputRef = { current: mockInput };

    renderHook(() => useKeyboardShortcuts(mockHandlers, searchInputRef));

    const event = new KeyboardEvent("keydown", { key: "/" });
    window.dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalledOnce();
    expect(mockHandlers.onSearch).not.toHaveBeenCalled();
  });

  it("does not trigger shortcuts when typing in input", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", {
      key: "n",
      bubbles: true,
    });
    Object.defineProperty(event, "target", { value: input, enumerable: true });
    input.dispatchEvent(event);

    expect(mockHandlers.onNewTask).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it("does not trigger shortcuts when typing in textarea", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    const event = new KeyboardEvent("keydown", {
      key: "n",
      bubbles: true,
    });
    Object.defineProperty(event, "target", {
      value: textarea,
      enumerable: true,
    });
    textarea.dispatchEvent(event);

    expect(mockHandlers.onNewTask).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it("does not trigger shortcuts in contentEditable elements", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const div = document.createElement("div");
    div.contentEditable = "true";
    document.body.appendChild(div);

    const event = new KeyboardEvent("keydown", {
      key: "n",
      bubbles: true,
    });
    Object.defineProperty(event, "target", { value: div, enumerable: true });
    div.dispatchEvent(event);

    expect(mockHandlers.onNewTask).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("removes event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useKeyboardShortcuts(mockHandlers));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function)
    );
  });
});
