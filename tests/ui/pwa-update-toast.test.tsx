/**
 * Tests for the PwaUpdateToast component.
 * Relocated from the former gap-closing.test.tsx padding file (finding F2.1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("PwaUpdateToast", () => {
  beforeEach(() => {
    // jsdom does not provide navigator.serviceWorker by default
    if (!("serviceWorker" in navigator)) {
      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        configurable: true,
      });
    }
  });

  it("renders nothing when no update is available", async () => {
    const { PwaUpdateToast } = await import("@/components/pwa-update-toast");

    const { container } = render(<PwaUpdateToast />);

    expect(container.firstChild).toBeNull();
  });

  it("renders the update toast when pwa-update-available fires", async () => {
    const { PwaUpdateToast } = await import("@/components/pwa-update-toast");

    render(<PwaUpdateToast />);

    const mockWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    window.dispatchEvent(
      new CustomEvent("pwa-update-available", { detail: mockWorker })
    );

    expect(await screen.findByText("Update Available")).toBeInTheDocument();
    expect(screen.getByText("Refresh Now")).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
  });

  it("dismisses when Later is clicked", async () => {
    const { PwaUpdateToast } = await import("@/components/pwa-update-toast");
    const user = userEvent.setup();

    render(<PwaUpdateToast />);

    const mockWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    window.dispatchEvent(
      new CustomEvent("pwa-update-available", { detail: mockWorker })
    );

    await screen.findByText("Update Available");
    await user.click(screen.getByText("Later"));

    expect(screen.queryByText("Update Available")).not.toBeInTheDocument();
  });
});
