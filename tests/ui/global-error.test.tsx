import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalError from "@/app/global-error";

vi.mock("@/lib/sentry", () => ({
  captureException: vi.fn(),
}));

describe("GlobalError", () => {
  const mockReset = vi.fn();
  const testError = Object.assign(new Error("Layout crashed"), { digest: "abc123" });

  it("renders error heading and reassuring message", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/Your data is safe in local storage/)).toBeInTheDocument();
  });

  it("announces and focuses the root fallback", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    const alert = screen.getByRole("alert", { name: "Something went wrong" });
    expect(alert).toHaveFocus();
    expect(alert).toHaveAttribute("tabindex", "-1");
  });

  it("displays error message in collapsible details", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    expect(screen.getByText("Error details")).toBeInTheDocument();
    expect(screen.getByText("Layout crashed")).toBeInTheDocument();
  });

  it("calls reset when Try again button is clicked", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    fireEvent.click(screen.getByText("Try again"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("calls captureException with error and digest on mount", async () => {
    const { captureException } = await import("@/lib/sentry");
    const mockCapture = vi.mocked(captureException);
    mockCapture.mockClear();

    render(<GlobalError error={testError} reset={mockReset} />);

    expect(mockCapture).toHaveBeenCalledWith(testError, { digest: "abc123" });
  });

  it("renders without crash when error.message is empty", () => {
    const emptyError = Object.assign(new Error(""), { digest: undefined });
    render(<GlobalError error={emptyError} reset={mockReset} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    // No details section when message is empty
    expect(screen.queryByText("Error details")).not.toBeInTheDocument();
  });

  it("navigates home when Go home button is clicked", () => {
    delete (window as { location?: unknown }).location;
    window.location = { href: "" } as unknown as Location;

    render(<GlobalError error={testError} reset={mockReset} />);

    fireEvent.click(screen.getByText("Go home"));
    expect(window.location.href).toBe("/");
  });

  it("uses the Violet Frost palette when the root stylesheet is unavailable", () => {
    render(<GlobalError error={testError} reset={mockReset} />);

    expect(document.body).toHaveStyle({ background: "#F3F3F7", color: "#242331" });
    expect(screen.getByText(/Your data is safe/)).toHaveStyle({ color: "#646477" });
    expect(screen.getByText("Try again")).toHaveStyle({ background: "#5C4F7D" });
    expect(screen.getByText("Go home")).toHaveStyle({
      color: "#242331",
      border: "1px solid #D9D9E4",
    });
  });
});
