import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

describe("NotFound", () => {
  it("renders 404 heading", () => {
    render(<NotFound />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("renders explanatory message", () => {
    render(<NotFound />);

    expect(
      screen.getByText(/doesn.t exist or has been moved/)
    ).toBeInTheDocument();
  });

  it("provides a link back to the app root", () => {
    render(<NotFound />);

    const link = screen.getByRole("link", { name: /return to task manager/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
