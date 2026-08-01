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
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);

    // Verify isContentEditable is set
    expect(div.isContentEditable).toBe(true);

    // Create event that will bubble to window with contentEditable div as target
    const event = new KeyboardEvent("keydown", {
      key: "n",
      bubbles: true,
    });
    
    // Dispatch from the contentEditable element so it bubbles to window
    // The event.target will be the div
    div.dispatchEvent(event);

    expect(mockHandlers.onNewTask).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("does not claim Option shortcuts reserved for the app shell", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));

    const event = new KeyboardEvent("keydown", {
      code: "KeyN",
      key: "n",
      altKey: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(mockHandlers.onNewTask).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does not trigger shortcuts from a select or nested contentEditable child", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    const select = document.createElement("select");
    document.body.appendChild(select);
    select.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));

    const editable = document.createElement("div");
    editable.contentEditable = "true";
    const child = document.createElement("span");
    editable.appendChild(child);
    document.body.appendChild(editable);
    child.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));

    expect(mockHandlers.onNewTask).not.toHaveBeenCalled();
    expect(mockHandlers.onSearch).not.toHaveBeenCalled();

    select.remove();
    editable.remove();
  });

  it("does not trigger while a modal is open or for blocked keyboard events", () => {
    renderHook(() => useKeyboardShortcuts(mockHandlers));
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
    modal.remove();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", repeat: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", isComposing: true }));
    const handled = new KeyboardEvent("keydown", { key: "n", cancelable: true });
    handled.preventDefault();
    window.dispatchEvent(handled);

    expect(mockHandlers.onNewTask).not.toHaveBeenCalled();
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
