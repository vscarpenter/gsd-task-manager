import { afterEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useToastFocusReturn } from "@/components/ui/toast-focus-return";

function pressHotkey(): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { altKey: true, code: "KeyT", bubbles: true }));
}

function mountPage(): { main: HTMLElement; card: HTMLButtonElement } {
  document.body.innerHTML = `
    <main id="main-content" tabindex="-1"><button id="card">Complete</button></main>
    <section aria-label="Notifications Alt+T"><ol><li><button id="undo">Undo</button></li></ol></section>`;
  return {
    main: document.getElementById("main-content") as HTMLElement,
    card: document.getElementById("card") as HTMLButtonElement,
  };
}

describe("useToastFocusReturn", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("returns focus to the main region when the focused element is gone", async () => {
    const { main, card } = mountPage();
    renderHook(() => useToastFocusReturn());
    card.focus();
    pressHotkey();
    document.getElementById("undo")?.focus();

    card.remove();
    document.getElementById("undo")?.remove();

    await waitFor(() => expect(main).toHaveFocus());
  });

  it("returns focus to the same element when it is still there", async () => {
    const { card } = mountPage();
    renderHook(() => useToastFocusReturn());
    card.focus();
    pressHotkey();
    document.getElementById("undo")?.focus();

    document.getElementById("undo")?.remove();

    await waitFor(() => expect(card).toHaveFocus());
  });

  it("leaves focus alone when the user moved it somewhere real", async () => {
    const { main, card } = mountPage();
    renderHook(() => useToastFocusReturn());
    card.focus();
    pressHotkey();
    const other = document.createElement("button");
    main.append(other);
    other.focus();

    card.remove();
    await Promise.resolve();

    expect(other).toHaveFocus();
    expect(main).not.toHaveFocus();
  });

  it("ignores other Alt chords", async () => {
    const { main, card } = mountPage();
    renderHook(() => useToastFocusReturn());
    card.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { altKey: true, code: "KeyU", bubbles: true }));

    card.remove();
    await Promise.resolve();

    expect(main).not.toHaveFocus();
  });
});
