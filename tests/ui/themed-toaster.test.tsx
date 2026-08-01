import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ThemedToaster } from "@/components/ui/themed-toaster";

const toasterSpy = vi.fn(() => null);

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => toasterSpy(props),
}));

describe("ThemedToaster", () => {
  it("uses a server-safe snapshot before applying the resolved client theme", () => {
    renderToString(<ThemedToaster />);
    expect(toasterSpy.mock.calls[0]?.[0]).toMatchObject({ theme: "system" });

    toasterSpy.mockClear();
    render(<ThemedToaster />);
    expect(toasterSpy.mock.calls.at(-1)?.[0]).toMatchObject({ theme: "dark" });
  });
});
