import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { type KeyboardEvent } from "react";
import { useDialogFocus } from "@/components/matrix-simplified/use-dialog-focus";

function makeContainer(html: string): HTMLDivElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function tabEvent(shiftKey: boolean): {
  event: KeyboardEvent<HTMLElement>;
  preventDefault: ReturnType<typeof vi.fn>;
} {
  const preventDefault = vi.fn();
  return {
    event: { key: "Tab", shiftKey, preventDefault } as unknown as KeyboardEvent<HTMLElement>,
    preventDefault,
  };
}

describe("useDialogFocus — Tab trap", () => {
  it("wraps Tab from the last focusable back to the first", () => {
    const container = makeContainer('<button id="a">A</button><button id="b">B</button>');
    const { result } = renderHook(() => useDialogFocus(true, { current: container }));
    const a = container.querySelector<HTMLElement>("#a")!;
    container.querySelector<HTMLElement>("#b")!.focus();

    const { event, preventDefault } = tabEvent(false);
    result.current(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(a).toHaveFocus();
    document.body.removeChild(container);
  });

  it("wraps Shift+Tab from the first focusable to the last", () => {
    const container = makeContainer('<button id="a">A</button><button id="b">B</button>');
    const { result } = renderHook(() => useDialogFocus(true, { current: container }));
    const b = container.querySelector<HTMLElement>("#b")!;
    container.querySelector<HTMLElement>("#a")!.focus();

    const { event, preventDefault } = tabEvent(true);
    result.current(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(b).toHaveFocus();
    document.body.removeChild(container);
  });

  it("does not trap when focus is mid-list (lets the browser advance)", () => {
    const container = makeContainer(
      '<button id="a">A</button><button id="b">B</button><button id="c">C</button>'
    );
    const { result } = renderHook(() => useDialogFocus(true, { current: container }));
    const a = container.querySelector<HTMLElement>("#a")!;
    a.focus();

    const { event, preventDefault } = tabEvent(false); // forward from first, not last → no wrap
    result.current(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(a).toHaveFocus();
    document.body.removeChild(container);
  });

  it("excludes disabled controls when computing first/last", () => {
    const container = makeContainer(
      '<button id="a">A</button><button id="b">B</button><button id="c" disabled>C</button>'
    );
    const { result } = renderHook(() => useDialogFocus(true, { current: container }));
    const a = container.querySelector<HTMLElement>("#a")!;
    container.querySelector<HTMLElement>("#b")!.focus(); // b is the last ENABLED control

    const { event, preventDefault } = tabEvent(false);
    result.current(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(a).toHaveFocus();
    document.body.removeChild(container);
  });

  it("ignores non-Tab keys", () => {
    const container = makeContainer('<button id="a">A</button>');
    const { result } = renderHook(() => useDialogFocus(true, { current: container }));
    const preventDefault = vi.fn();

    result.current({
      key: "Enter",
      shiftKey: false,
      preventDefault,
    } as unknown as KeyboardEvent<HTMLElement>);

    expect(preventDefault).not.toHaveBeenCalled();
    document.body.removeChild(container);
  });
});
