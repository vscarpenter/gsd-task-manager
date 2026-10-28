import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewPrompts } from "@/components/dashboard/review-prompts";

const distribution = {
  "urgent-important": 4,
  "not-urgent-important": 2,
  "urgent-not-important": 1,
  "not-urgent-not-important": 3,
};

describe("ReviewPrompts", () => {
  it("lets the section heading speak without an eyebrow above it", () => {
    render(<ReviewPrompts distribution={distribution} />);

    expect(screen.getByRole("heading", { name: "See where your open tasks are." })).toBeInTheDocument();
    expect(screen.queryByText("Reflection prompts")).toBeNull();
  });

  it("names each prompt's quadrant as a caption, not another tracked eyebrow", () => {
    render(<ReviewPrompts distribution={distribution} />);

    const label = screen.getByText("Do First");
    expect(label.className).toContain("text-caption");
    expect(label.className).not.toContain("text-eyebrow");
    expect(label.className).not.toContain("uppercase");
  });
});
