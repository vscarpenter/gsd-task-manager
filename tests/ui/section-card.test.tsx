import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionCard } from "@/components/settings-page/section-card";

function renderCard() {
  return render(
    <SectionCard title="Appearance" description="Theme and display preferences">
      <div>rows</div>
    </SectionCard>
  );
}

describe("SectionCard", () => {
  it("heads the section with its title and description alone", () => {
    const { container } = renderCard();

    expect(screen.getByRole("heading", { level: 2, name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByText("Theme and display preferences")).toBeInTheDocument();
    // The sidebar already shows this item's group and icon right beside it.
    expect(container.querySelector("header .text-eyebrow")).toBeNull();
    expect(container.querySelector("header svg")).toBeNull();
  });

  it("sits on the pane radius with a plain header", () => {
    const { container } = renderCard();

    expect(container.querySelector("section")?.className).toContain("rounded-lg");
    expect(container.querySelector("header")?.className).not.toMatch(/gradient/);
  });
});
