import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "@/components/ui/segmented-control";

const options = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
] as const;

describe("SegmentedControl", () => {
  it("uses a named native radio group with coarse-pointer targets", () => {
    render(
      <SegmentedControl
        label="Completion trend period"
        options={options}
        value="30"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("group", { name: "Completion trend period" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "30 Days" })).toBeChecked();
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.closest("label")).toHaveClass("touch-target");
    }
  });

  it("marks the selected period with a persistent non-color indicator", () => {
    render(
      <SegmentedControl
        label="Completion trend period"
        options={options}
        value="30"
        onChange={vi.fn()}
      />
    );

    const selectedLabel = screen.getByRole("radio", { name: "30 Days" }).closest("label");
    expect(selectedLabel).toHaveClass("border-control-border");
    expect(screen.getByTestId("selected-segment-indicator")).toBeInTheDocument();

    expect(screen.getByRole("radio", { name: "7 Days" }).closest("label"))
      .toHaveClass("border-transparent");
    expect(screen.getByRole("radio", { name: "90 Days" }).closest("label"))
      .toHaveClass("border-transparent");
  });

  it("uses native arrow-key movement to change the selected period", async () => {
    function StatefulControl() {
      const [value, setValue] = useState<"7" | "30" | "90">("7");
      return (
        <SegmentedControl
          label="Completion trend period"
          options={options}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<StatefulControl />);
    screen.getByRole("radio", { name: "7 Days" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "30 Days" })).toBeChecked();
  });
});
