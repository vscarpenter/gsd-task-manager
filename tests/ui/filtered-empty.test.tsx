import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilteredEmpty } from "@/components/matrix-simplified/filtered-empty";

describe("FilteredEmpty", () => {
  it("shows a short query in full", () => {
    render(<FilteredEmpty query="  groceries " onClear={vi.fn()} />);
    expect(screen.getByTestId("filtered-empty")).toHaveTextContent("No tasks match “groceries”");
  });

  it("truncates a very long query with an ellipsis and lets it wrap", () => {
    const query = "a".repeat(10_000);
    render(<FilteredEmpty query={query} onClear={vi.fn()} />);

    const heading = screen.getByText(/^No tasks match/);
    expect(heading.textContent?.length).toBeLessThan(120);
    expect(heading.textContent).toContain("…");
    expect(heading.className).toContain("break-words");
  });
});
