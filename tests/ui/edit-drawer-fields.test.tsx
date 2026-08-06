import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DueDateField,
  Field,
  QuadrantField,
  TagsField,
} from "@/components/matrix-simplified/edit-drawer-fields";

describe("edit drawer field semantics", () => {
  it("keeps a simple control associated with its native label", () => {
    render(
      <Field label="Description">
        <textarea />
      </Field>
    );

    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("renders the quadrant choices as a named group without wrapping buttons in a label", () => {
    const { container } = render(
      <QuadrantField urgent important onChange={vi.fn()} />
    );

    expect(screen.getByRole("group", { name: "Quadrant" })).toBeInTheDocument();
    expect(container.querySelector("label button")).toBeNull();
  });

  it("renders due-date controls as a named group without wrapping buttons in a label", () => {
    const { container } = render(
      <DueDateField
        duePreset="none"
        customDate={undefined}
        showCustomDateInput={false}
        onPresetChange={vi.fn()}
        onCustomDateChange={vi.fn()}
        onToggleCustomInput={vi.fn()}
      />
    );

    expect(screen.getByRole("group", { name: "Due date" })).toBeInTheDocument();
    expect(container.querySelector("label button")).toBeNull();
  });

  it("renders tag controls as a named group without wrapping controls in a label", () => {
    const { container } = render(
      <TagsField
        tags={["planning"]}
        tagInput=""
        onTagInputChange={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onTagKeyDown={vi.fn()}
      />
    );

    expect(screen.getByRole("group", { name: "Tags" })).toBeInTheDocument();
    expect(container.querySelector("label button, label input")).toBeNull();
  });
});
