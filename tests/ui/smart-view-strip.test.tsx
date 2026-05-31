import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SmartView } from "@/lib/filters";
import {
  SmartViewStrip,
  SmartViewOverflowMenu,
} from "@/components/matrix-simplified/smart-view-strip";
import { computeVisibleViewCount } from "@/components/matrix-simplified/use-smart-view-overflow";

// Render the Radix dropdown flat so menu items are always queryable in jsdom,
// matching the convention in task-card-subcomponents.test.tsx. The real
// keyboard/focus behavior is owned by Radix + the e2e suite.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    ...props
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" role="menuitem" onClick={onSelect} {...props}>
      {children}
    </button>
  ),
}));

// The overflow hook observes the strip container; jsdom lacks ResizeObserver.
if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

function makeView(id: string, name: string): SmartView {
  return {
    id,
    name,
    icon: "✨",
    criteria: {},
    isBuiltIn: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("computeVisibleViewCount", () => {
  it("returns every view when they all fit with room to spare", () => {
    const count = computeVisibleViewCount({
      viewWidths: [100, 100, 100],
      leadWidth: 80,
      moreWidth: 60,
      available: 1000,
      gap: 8,
    });
    expect(count).toBe(3);
  });

  it("returns every view when they fit the available width exactly (no More reserved)", () => {
    // lead(80) + gap(8) + view(100) = 188
    const count = computeVisibleViewCount({
      viewWidths: [100],
      leadWidth: 80,
      moreWidth: 60,
      available: 188,
      gap: 8,
    });
    expect(count).toBe(1);
  });

  it("returns 0 when only the pinned lead pill fits", () => {
    const count = computeVisibleViewCount({
      viewWidths: [100, 100],
      leadWidth: 80,
      moreWidth: 60,
      available: 100,
      gap: 8,
    });
    expect(count).toBe(0);
  });

  it("reserves room for the More button, pushing a pill into the menu that would otherwise fit", () => {
    // Both views fit a bare row exactly at 100 (0 + 50 + 50). At 99 the row
    // overflows, so More(20) must be reserved → budget 79 → only one pill fits.
    const count = computeVisibleViewCount({
      viewWidths: [50, 50],
      leadWidth: 0,
      moreWidth: 20,
      available: 99,
      gap: 0,
    });
    expect(count).toBe(1);
  });

  it("reserves the gap before the More button at narrow boundary widths", () => {
    // Rendered overflow row = lead + (gap + view) + gap + More.
    // 80 + (8 + 100) + 8 + 60 = 256 > 248, so one inline view would clip the
    // row by 8px. The correct answer is 0 inline — there is no room for a view
    // pill *and* the More button (with the gap between them).
    const count = computeVisibleViewCount({
      viewWidths: [100, 100],
      leadWidth: 80,
      moreWidth: 60,
      available: 248,
      gap: 8,
    });
    expect(count).toBe(0);
  });

  it("returns 0 for an empty view list", () => {
    const count = computeVisibleViewCount({
      viewWidths: [],
      leadWidth: 80,
      moreWidth: 60,
      available: 1000,
      gap: 8,
    });
    expect(count).toBe(0);
  });

  it("returns 0 when nothing has been measured yet (zero available width)", () => {
    const count = computeVisibleViewCount({
      viewWidths: [0, 0],
      leadWidth: 0,
      moreWidth: 0,
      available: 0,
      gap: 8,
    });
    expect(count).toBe(0);
  });
});

describe("<SmartViewOverflowMenu>", () => {
  const overflow = [makeView("a", "Recurring Tasks"), makeView("b", "Ready to Work")];

  it("renders a trigger whose accessible name carries the overflow count", () => {
    render(
      <SmartViewOverflowMenu views={overflow} activeViewId={null} onSelectView={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /more/i })).toHaveAccessibleName(/2/);
  });

  it("names the active view in the trigger when the active filter is hidden in the menu", () => {
    render(
      <SmartViewOverflowMenu views={overflow} activeViewId="b" onSelectView={vi.fn()} />
    );
    // Conveyed to AT via the accessible name, not by color alone.
    expect(screen.getByRole("button", { name: /more/i })).toHaveAccessibleName(
      /Ready to Work/
    );
  });

  it("lists each overflow view as a menu item", () => {
    render(
      <SmartViewOverflowMenu views={overflow} activeViewId={null} onSelectView={vi.fn()} />
    );
    expect(screen.getByRole("menuitem", { name: /Recurring Tasks/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Ready to Work/ })).toBeInTheDocument();
  });

  it("calls onSelectView with the view id when a menu item is chosen", async () => {
    const onSelectView = vi.fn();
    render(
      <SmartViewOverflowMenu views={overflow} activeViewId={null} onSelectView={onSelectView} />
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Ready to Work/ }));
    expect(onSelectView).toHaveBeenCalledWith("b");
  });

  it("marks the active view's menu item with aria-current", () => {
    render(
      <SmartViewOverflowMenu views={overflow} activeViewId="b" onSelectView={vi.fn()} />
    );
    expect(screen.getByRole("menuitem", { name: /Ready to Work/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });
});

describe("<SmartViewStrip>", () => {
  it("renders nothing when there are no views", () => {
    const { container } = render(
      <SmartViewStrip views={[]} onSelectView={vi.fn()} onClearView={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("always shows the pinned 'All tasks' pill and clears the filter when clicked", async () => {
    const onClearView = vi.fn();
    render(
      <SmartViewStrip
        views={[makeView("a", "Recurring Tasks")]}
        activeViewId="a"
        onSelectView={vi.fn()}
        onClearView={onClearView}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "All tasks" }));
    expect(onClearView).toHaveBeenCalledTimes(1);
  });

  it("exposes the pill row as a group labeled for assistive tech", () => {
    render(
      <SmartViewStrip
        views={[makeView("a", "Recurring Tasks")]}
        onSelectView={vi.fn()}
        onClearView={vi.fn()}
      />
    );
    expect(screen.getByRole("group", { name: "Smart views" })).toBeInTheDocument();
  });

  it("applies a smart view when its inline pill is clicked", async () => {
    const onSelectView = vi.fn();
    render(
      <SmartViewStrip
        views={[makeView("a", "Recurring Tasks")]}
        activeViewId={null}
        onSelectView={onSelectView}
        onClearView={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Recurring Tasks/ }));
    expect(onSelectView).toHaveBeenCalledWith("a");
  });

  it("marks 'All tasks' as pressed when no smart view is active", () => {
    render(
      <SmartViewStrip
        views={[makeView("a", "Recurring Tasks")]}
        activeViewId={null}
        onSelectView={vi.fn()}
        onClearView={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "All tasks" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});

describe("<SmartViewStrip> measurement (faked layout)", () => {
  // jsdom has no layout engine, so fake fixed element dimensions to drive the
  // real measurement path. With a 250px container and 100px pills, only the
  // pinned "All tasks" pill + the More button fit — every view collapses.
  const realOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const realClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 100,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 250,
    });
  });

  afterAll(() => {
    if (realOffset) Object.defineProperty(HTMLElement.prototype, "offsetWidth", realOffset);
    if (realClient) Object.defineProperty(HTMLElement.prototype, "clientWidth", realClient);
  });

  it("collapses overflowing views into the More menu when the row is too narrow", () => {
    const views = [makeView("a", "View A"), makeView("b", "View B"), makeView("c", "View C")];
    render(
      <SmartViewStrip
        views={views}
        activeViewId={null}
        onSelectView={vi.fn()}
        onClearView={vi.fn()}
      />
    );
    // All three views collapse → the More button reports the full overflow count.
    expect(
      screen.getByRole("button", { name: /More smart views \(3\)/ })
    ).toBeInTheDocument();
    // ...and no view renders as an inline pill.
    expect(screen.queryByRole("button", { name: "View A" })).not.toBeInTheDocument();
  });
});
