import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/error-boundary";

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
};

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Child component")).toBeInTheDocument();
  });

  it("renders error UI when error is caught", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/An unexpected error occurred/)
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("displays error details when present", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Error details")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("provides reload page button", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    delete (window as { location?: unknown }).location;
    window.location = { reload: vi.fn() } as unknown as Location;

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText("Reload page");
    expect(reloadButton).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("provides go home button", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const homeButton = screen.getByText("Go home");
    expect(homeButton).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
