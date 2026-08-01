import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DesignLabOverview } from "@/components/design-lab/design-lab-overview";
import { DesignDirectionPrototype } from "@/components/design-lab/design-direction-prototype";
import { DESIGN_DIRECTIONS, DESIGN_TASKS } from "@/components/design-lab/design-data";

describe("DesignLabOverview", () => {
  it("links every direction to desktop and mobile previews", () => {
    render(<DesignLabOverview />);
    const directionIndex = screen.getByRole("region", { name: "Choose a direction to inspect" });

    expect(screen.getByRole("link", { name: "GSD design lab" })).toHaveAttribute("href", "/design-lab");

    for (const direction of DESIGN_DIRECTIONS) {
      expect(within(directionIndex).getByRole("heading", { name: direction.name })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: `Open prototype: ${direction.name} desktop preview` })).toHaveAttribute(
        "href",
        `/design-lab/${direction.slug}`,
      );
      expect(screen.getByRole("link", { name: `Mobile preview: ${direction.name}` })).toHaveAttribute(
        "href",
        `/design-lab/${direction.slug}?preview=mobile`,
      );
    }
  });

  it("changes both sides of the comparison without changing the shared task sample", async () => {
    const user = userEvent.setup();
    render(<DesignLabOverview />);

    const comparison = screen.getByTestId("design-comparison");
    expect(within(comparison).getAllByText(DESIGN_TASKS[0].title)).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText("Compare on the right"), "spatial-focus");
    expect(within(comparison).getByRole("heading", { name: "Spatial Focus" })).toBeInTheDocument();
    expect(within(comparison).getAllByText(DESIGN_TASKS[0].title)).toHaveLength(2);
  });
});

describe("DesignDirectionPrototype", () => {
  it.each(DESIGN_DIRECTIONS.map((direction) => direction.slug))(
    "renders shared tasks and core controls for %s",
    (slug) => {
      render(<DesignDirectionPrototype slug={slug} />);

      expect(screen.getByTestId("prototype-workspace")).toHaveAttribute("data-direction", slug);
      expect(screen.getByText(DESIGN_TASKS[0].title)).toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Search tasks" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /dark theme/i })).toBeInTheDocument();
    },
  );

  it("supports search, a useful no-results recovery, and clear", async () => {
    const user = userEvent.setup();
    render(<DesignDirectionPrototype slug="precision-utility" />);

    const search = screen.getByRole("searchbox", { name: "Search tasks" });
    await user.type(search, "privacy");
    expect(screen.getByText("Review household backup and recovery plan")).toBeInTheDocument();
    expect(screen.queryByText(DESIGN_TASKS[0].title)).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "nothing matches this phrase");
    expect(screen.getByText("No tasks match this view")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText(DESIGN_TASKS[0].title)).toBeInTheDocument();
    await waitFor(() => expect(search).toHaveFocus());
  });

  it("captures a mock task without touching persistence", async () => {
    const user = userEvent.setup();
    render(<DesignDirectionPrototype slug="refined-evolution" />);

    const capture = screen.getByTestId("prototype-capture-input");
    expect(capture).toHaveAccessibleDescription("Capture destination: Schedule");
    await user.type(capture, "Plan August review");
    await user.click(screen.getByTestId("prototype-capture-submit"));

    expect(screen.getByText("Plan August review")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Added Plan August review to Schedule");
  });

  it("retains, identifies, and focuses an invalid capture", async () => {
    const user = userEvent.setup();
    render(<DesignDirectionPrototype slug="editorial-planner" />);
    const capture = screen.getByTestId("prototype-capture-input");

    fireEvent.change(capture, { target: { value: "   " } });
    await user.click(screen.getByTestId("prototype-capture-submit"));

    expect(capture).toHaveValue("   ");
    expect(capture).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a task before adding it");
    expect(capture).toHaveFocus();
  });

  it("opens an accessible editor and saves a changed title", async () => {
    const user = userEvent.setup();
    render(<DesignDirectionPrototype slug="native-calm" />);

    await user.click(screen.getByTestId(`prototype-task-${DESIGN_TASKS[0].id}`));
    await user.click(screen.getByRole("button", { name: "Edit task" }));
    const dialog = screen.getByRole("dialog", { name: "Edit task" });
    const title = within(dialog).getByLabelText("Task title");
    await user.clear(title);
    await user.click(within(dialog).getByRole("button", { name: "Save task" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter a task title before saving");
    await user.type(title, "Submit renewal packet today");
    await user.click(within(dialog).getByRole("button", { name: "Save task" }));

    expect(screen.getByText("Submit renewal packet today")).toBeInTheDocument();
  });

  it("switches between matrix/review and light/dark states", () => {
    render(<DesignDirectionPrototype slug="spatial-focus" />);

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByTestId("prototype-review")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dark theme/i }));
    expect(screen.getByTestId("prototype-workspace")).toHaveAttribute("data-theme", "dark");

    fireEvent.click(screen.getByRole("button", { name: "Priorities" }));
    expect(screen.getByTestId("prototype-matrix")).toBeInTheDocument();
  });

  it("derives Refined Evolution's strategic share from the shared state", async () => {
    const user = userEvent.setup();
    render(<DesignDirectionPrototype slug="refined-evolution" />);

    await user.click(screen.getByRole("button", { name: "Review" }));
    let metric = screen.getByText("Strategic share").closest("article");
    expect(metric).not.toBeNull();
    expect(within(metric!).getByText("20%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Priorities" }));
    await user.type(screen.getByTestId("prototype-capture-input"), "Protect strategy time");
    await user.click(screen.getByTestId("prototype-capture-submit"));
    await user.click(screen.getByRole("button", { name: "Review" }));

    metric = screen.getByText("Strategic share").closest("article");
    expect(within(metric!).getByText("27%")).toBeInTheDocument();
  });

  it("can initialize directly in dark theme", () => {
    render(<DesignDirectionPrototype slug="native-calm" initialTheme="dark" />);
    expect(screen.getByTestId("prototype-workspace")).toHaveAttribute("data-theme", "dark");
  });

  it("requires Option-modified precision shortcuts and restores focus after a view change", async () => {
    render(<DesignDirectionPrototype slug="precision-utility" />);

    fireEvent.keyDown(document, { code: "KeyR", key: "r" });
    expect(screen.getByTestId("prototype-matrix")).toBeInTheDocument();

    fireEvent.keyDown(document, { code: "KeyR", key: "®", altKey: true });
    const review = screen.getByTestId("prototype-review");
    expect(review).toBeInTheDocument();
    await waitFor(() => expect(review).toHaveFocus());
  });

  it("moves focus to stable review content when completion removes a ranked row", async () => {
    const user = userEvent.setup();
    render(<DesignDirectionPrototype slug="precision-utility" />);
    await user.click(screen.getByRole("button", { name: "Review" }));
    const review = screen.getByTestId("prototype-review");

    await user.click(screen.getByRole("button", { name: `Complete ${DESIGN_TASKS[0].title}` }));
    await waitFor(() => expect(review).toHaveFocus());
  });

  it("exposes Native Calm selection and moves focus to the updated inspector", async () => {
    const user = userEvent.setup();
    render(<DesignDirectionPrototype slug="native-calm" />);
    const row = screen.getByTestId(`prototype-task-${DESIGN_TASKS[1].id}`);

    await user.click(row);

    expect(row).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByRole("heading", { name: `Review “${DESIGN_TASKS[1].title}”` })).toHaveFocus());
  });

  it("keeps Native Calm row selection aligned with the inspected search result", async () => {
    const user = userEvent.setup();
    render(<DesignDirectionPrototype slug="native-calm" />);

    await user.type(screen.getByRole("searchbox", { name: "Search tasks" }), "privacy");

    const visibleTask = screen.getByTestId("prototype-task-backup-plan");
    expect(visibleTask).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: /Review “Review household backup/i })).toBeInTheDocument();
  });

  it("keeps Spatial Focus accessible names aligned with visible action text", () => {
    render(<DesignDirectionPrototype slug="spatial-focus" />);
    expect(screen.getByRole("button", { name: "Bring forward Do First" })).toHaveTextContent("Bring forward");
  });
});
