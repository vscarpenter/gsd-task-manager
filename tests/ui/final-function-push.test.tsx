/**
 * Final push for function coverage threshold.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMockTask } from "@/tests/fixtures";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// TaskDragOverlay
// ---------------------------------------------------------------------------

vi.mock("@dnd-kit/core", () => ({
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
  useSensors: vi.fn(() => []),
  useSensor: vi.fn(() => ({})),
  PointerSensor: {},
  TouchSensor: {},
}));

describe("TaskDragOverlay", () => {
  it("renders nothing when no active task", async () => {
    const { TaskDragOverlay } = await import("@/components/matrix-board/task-drag-overlay");
    render(<TaskDragOverlay activeTask={undefined} />);
    expect(screen.getByTestId("drag-overlay")).toBeInTheDocument();
    expect(screen.queryByText("Test Task")).not.toBeInTheDocument();
  });

  it("renders task title when active", async () => {
    const { TaskDragOverlay } = await import("@/components/matrix-board/task-drag-overlay");
    const task = createMockTask({ title: "Dragged Task", tags: ["tag1", "tag2"] });
    render(<TaskDragOverlay activeTask={task} />);
    expect(screen.getByText("Dragged Task")).toBeInTheDocument();
    expect(screen.getByText("tag1")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// About section components (75% func)
// ---------------------------------------------------------------------------

vi.mock("@/components/about/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("AboutSection components", () => {
  it("HeroSection renders headline", async () => {
    const { HeroSection } = await import("@/components/about/hero-section");
    render(<HeroSection />);
    expect(screen.getByText(/GSD/)).toBeInTheDocument();
  });

  it("PrivacySection renders", async () => {
    const { PrivacySection } = await import("@/components/about/privacy-section");
    render(<PrivacySection />);
    expect(screen.getByText(/your device/i)).toBeInTheDocument();
  });

  it("FooterCta renders", async () => {
    const { FooterCta } = await import("@/components/about/footer-cta");
    render(<FooterCta />);
    // Should render some CTA content
    expect(document.body.textContent).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// UserGuide WizardView — callback functions
// ---------------------------------------------------------------------------

vi.mock("@/components/user-guide/getting-started-section", () => ({
  GettingStartedSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>GS Content</div> : null,
}));
vi.mock("@/components/user-guide/power-features-section", () => ({
  PowerFeaturesSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>PF Content</div> : null,
}));
vi.mock("@/components/user-guide/matrix-section", () => ({
  MatrixSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>M Content</div> : null,
}));
vi.mock("@/components/user-guide/task-management-section", () => ({
  TaskManagementSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>TM Content</div> : null,
}));
vi.mock("@/components/user-guide/advanced-features-section", () => ({
  AdvancedFeaturesSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>AF Content</div> : null,
}));
vi.mock("@/components/user-guide/smart-views-section", () => ({
  SmartViewsSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>SV Content</div> : null,
}));
vi.mock("@/components/user-guide/batch-operations-section", () => ({
  BatchOperationsSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>BO Content</div> : null,
}));
vi.mock("@/components/user-guide/dashboard-section", () => ({
  DashboardSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>D Content</div> : null,
}));
vi.mock("@/components/user-guide/workflows-section", () => ({
  WorkflowsSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>W Content</div> : null,
}));
vi.mock("@/components/user-guide/data-privacy-section", () => ({
  DataPrivacySection: ({ expanded }: { expanded: boolean }) => expanded ? <div>DP Content</div> : null,
}));
vi.mock("@/components/user-guide/shortcuts-section", () => ({
  ShortcutsSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>S Content</div> : null,
}));
vi.mock("@/components/user-guide/pwa-section", () => ({
  PwaSection: ({ expanded }: { expanded: boolean }) => expanded ? <div>PWA Content</div> : null,
}));

// ---------------------------------------------------------------------------
// NotFound page
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("NotFound page", () => {
  it("renders 404 heading", async () => {
    const { default: NotFound } = await import("@/app/not-found");
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// WizardView
// ---------------------------------------------------------------------------

vi.mock("@/components/user-guide/wizard-container", () => ({
  WizardContainer: ({ children, onNext, onPrevious }: { children: React.ReactNode; onNext: () => void; onPrevious: () => void }) => (
    <div data-testid="wizard">
      {children}
      <button onClick={onNext}>Next</button>
      <button onClick={onPrevious}>Previous</button>
    </div>
  ),
}));

vi.mock("@/components/user-guide/wizard-steps", () => ({
  StepWelcome: () => <div>Welcome Step</div>,
  StepMatrix: () => <div>Matrix Step</div>,
  StepTasks: () => <div>Tasks Step</div>,
  StepPowerFeatures: () => <div>Power Step</div>,
  StepWorkflows: () => <div>Workflows Step</div>,
  StepFinal: () => <div>Final Step</div>,
  TOTAL_STEPS: 6,
}));

// ---------------------------------------------------------------------------
// UserGuideDialog — handleClose and ModeToggle
// ---------------------------------------------------------------------------

vi.mock("@/lib/hooks/use-guide-mode", () => ({
  useGuideMode: () => ({ toggleMode: vi.fn(), isWizard: true }),
}));

describe("UserGuideDialog", () => {
  it("renders with wizard mode", async () => {
    const { UserGuideDialog } = await import("@/components/user-guide-dialog");
    render(<UserGuideDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("User Guide")).toBeInTheDocument();
    expect(screen.getByText(/step-by-step/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CommandGroup
// ---------------------------------------------------------------------------

describe("CommandGroup", () => {
  it("returns null for empty actions", async () => {
    const { CommandGroup } = await import("@/components/command-palette/command-group");
    const { container } = render(<CommandGroup heading="Test" actions={[]} onExecute={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("WizardView", () => {
  it("renders first step and navigates with Next/Previous", async () => {
    const { WizardView } = await import("@/components/user-guide/wizard-view");
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();

    render(<WizardView onComplete={vi.fn()} />);
    expect(screen.getByText("Welcome Step")).toBeInTheDocument();

    // Click Next to go to step 2
    await user.click(screen.getByText("Next"));
    expect(screen.getByText("Matrix Step")).toBeInTheDocument();

    // Click Previous to go back
    await user.click(screen.getByText("Previous"));
    expect(screen.getByText("Welcome Step")).toBeInTheDocument();
  });
});
