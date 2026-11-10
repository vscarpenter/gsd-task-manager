import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ThemedToaster } from "@/components/ui/themed-toaster";

const toasterSpy = vi.fn((_props: unknown) => null);

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => toasterSpy(props),
  useSonner: () => ({ toasts: [] }),
}));

describe("ThemedToaster", () => {
  it("uses a server-safe snapshot before applying the resolved client theme", () => {
    renderToString(<ThemedToaster />);
    expect(toasterSpy.mock.calls[0]?.[0]).toMatchObject({ theme: "system" });

    toasterSpy.mockClear();
    render(<ThemedToaster />);
    expect(toasterSpy.mock.calls.at(-1)?.[0]).toMatchObject({ theme: "dark" });
  });

  it("keeps the toast below the top bar on desktop and mobile", () => {
    toasterSpy.mockClear();
    render(<ThemedToaster />);
    expect(toasterSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      position: "top-center",
      offset: { top: 80 },
      mobileOffset: { top: 130 },
    });
  });

  it("pins the toast hotkey to Alt+T, the key the screen-reader hint names", () => {
    toasterSpy.mockClear();
    render(<ThemedToaster />);
    expect(toasterSpy.mock.calls.at(-1)?.[0]).toMatchObject({ hotkey: ["altKey", "KeyT"] });
  });
});
