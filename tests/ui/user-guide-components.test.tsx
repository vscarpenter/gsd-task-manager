/* eslint-disable react/no-unescaped-entities */
import { render, screen, fireEvent } from "@testing-library/react";
import { RocketIcon, ZapIcon, GridIcon } from "lucide-react";

// --- Shared components ---
import {
  GuideSection,
  QuadrantBlock,
  FeatureBlock,
  AdvancedFeature,
  WorkflowBlock,
  ShortcutRow,
} from "@/components/user-guide/shared-components";

// --- Section components ---
import { GettingStartedSection } from "@/components/user-guide/getting-started-section";
import { MatrixSection } from "@/components/user-guide/matrix-section";
import { TaskManagementSection } from "@/components/user-guide/task-management-section";
import { PowerFeaturesSection } from "@/components/user-guide/power-features-section";
import { AdvancedFeaturesSection } from "@/components/user-guide/advanced-features-section";
import { SmartViewsSection } from "@/components/user-guide/smart-views-section";
import { BatchOperationsSection } from "@/components/user-guide/batch-operations-section";
import { DashboardSection } from "@/components/user-guide/dashboard-section";
import { WorkflowsSection } from "@/components/user-guide/workflows-section";
import { DataPrivacySection } from "@/components/user-guide/data-privacy-section";
import { ShortcutsSection } from "@/components/user-guide/shortcuts-section";
import { PwaSection } from "@/components/user-guide/pwa-section";

// --- Container views ---
import { AccordionView } from "@/components/user-guide/accordion-view";
import { WizardView } from "@/components/user-guide/wizard-view";
import { WizardContainer } from "@/components/user-guide/wizard-container";

// --- Wizard steps ---
import { StepWelcome } from "@/components/user-guide/wizard-steps/step-welcome";
import { StepMatrix } from "@/components/user-guide/wizard-steps/step-matrix";
import { StepTasks } from "@/components/user-guide/wizard-steps/step-tasks";
import { StepPowerFeatures } from "@/components/user-guide/wizard-steps/step-power-features";
import { StepWorkflows } from "@/components/user-guide/wizard-steps/step-workflows";
import { StepFinal } from "@/components/user-guide/wizard-steps/step-final";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ─── Shared Components ──────────────────────────────────────────────

describe("Shared Components", () => {
  describe("GuideSection", () => {
    it("renders title and children when expanded", () => {
      render(
        <GuideSection
          icon={<RocketIcon />}
          title="Test Section"
          expanded={true}
          onToggle={vi.fn()}
        >
          <p>Section content</p>
        </GuideSection>
      );

      expect(screen.getByText("Test Section")).toBeInTheDocument();
      expect(screen.getByText("Section content")).toBeInTheDocument();
    });

    it("calls onToggle when trigger is clicked", () => {
      const onToggle = vi.fn();
      render(
        <GuideSection
          icon={<RocketIcon />}
          title="Toggle Test"
          expanded={false}
          onToggle={onToggle}
        >
          <p>Hidden</p>
        </GuideSection>
      );

      fireEvent.click(screen.getByText("Toggle Test"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe("QuadrantBlock", () => {
    it("renders title, description, examples, strategy, and time allocation", () => {
      render(
        <QuadrantBlock
          title="Q1: Do First"
          color="bg-red-100 text-red-700"
          description="Crises and deadlines"
          examples={["Client presentation", "System outage"]}
          strategy="Minimize by planning ahead"
          timeAllocation="15-20%"
        />
      );

      expect(screen.getByText("Q1: Do First")).toBeInTheDocument();
      expect(screen.getByText("Crises and deadlines")).toBeInTheDocument();
      expect(screen.getByText("Client presentation")).toBeInTheDocument();
      expect(screen.getByText("System outage")).toBeInTheDocument();
      expect(screen.getByText(/Minimize by planning/)).toBeInTheDocument();
      expect(screen.getByText("Target: 15-20%")).toBeInTheDocument();
    });
  });

  describe("FeatureBlock", () => {
    it("renders title and list items", () => {
      render(
        <FeatureBlock
          title="Task Features"
          items={["Due dates", "Tags", "Subtasks"]}
        />
      );

      expect(screen.getByText("Task Features")).toBeInTheDocument();
      expect(screen.getByText("Due dates")).toBeInTheDocument();
      expect(screen.getByText("Tags")).toBeInTheDocument();
      expect(screen.getByText("Subtasks")).toBeInTheDocument();
    });
  });

  describe("AdvancedFeature", () => {
    it("renders icon, title, description, and children", () => {
      render(
        <AdvancedFeature
          icon={<ZapIcon />}
          title="Recurring Tasks"
          description="Tasks that repeat on a schedule"
        >
          <p>Extra detail here</p>
        </AdvancedFeature>
      );

      expect(screen.getByText("Recurring Tasks")).toBeInTheDocument();
      expect(
        screen.getByText("Tasks that repeat on a schedule")
      ).toBeInTheDocument();
      expect(screen.getByText("Extra detail here")).toBeInTheDocument();
    });
  });

  describe("WorkflowBlock", () => {
    it("renders title and ordered steps", () => {
      render(
        <WorkflowBlock
          title="Morning Review"
          steps={["Check Q1 tasks", "Plan Q2 work", "Clear inbox"]}
        />
      );

      expect(screen.getByText("Morning Review")).toBeInTheDocument();
      expect(screen.getByText("Check Q1 tasks")).toBeInTheDocument();
      expect(screen.getByText("Plan Q2 work")).toBeInTheDocument();
      expect(screen.getByText("Clear inbox")).toBeInTheDocument();
    });
  });

  describe("ShortcutRow", () => {
    it("renders shortcut key and description", () => {
      render(<ShortcutRow shortcut="N" description="New task" />);

      expect(screen.getByText("N")).toBeInTheDocument();
      expect(screen.getByText("New task")).toBeInTheDocument();
    });
  });
});

// ─── Section Components (Accordion Sections) ────────────────────────

describe("Section Components", () => {
  const sectionProps = { expanded: true, onToggle: vi.fn() };

  it("GettingStartedSection renders key content", () => {
    render(<GettingStartedSection {...sectionProps} />);
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(
      screen.getByText(/Welcome to GSD Task Manager/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Creating Your First Task/)).toBeInTheDocument();
  });

  it("MatrixSection renders quadrant headings", () => {
    render(<MatrixSection {...sectionProps} />);
    expect(
      screen.getByText("The Eisenhower Matrix Deep Dive")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Q1: Do First (Urgent + Important)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Q2: Schedule (Not Urgent + Important)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Q3: Delegate (Urgent + Not Important)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Q4: Eliminate (Not Urgent + Not Important)")
    ).toBeInTheDocument();
  });

  it("TaskManagementSection renders title", () => {
    render(<TaskManagementSection {...sectionProps} />);
    expect(screen.getByText("Core Task Management")).toBeInTheDocument();
  });

  it("PowerFeaturesSection renders title", () => {
    render(<PowerFeaturesSection {...sectionProps} />);
    expect(screen.getByText(/Power Features/)).toBeInTheDocument();
  });

  it("AdvancedFeaturesSection renders title", () => {
    render(<AdvancedFeaturesSection {...sectionProps} />);
    expect(screen.getByText(/Advanced Features/)).toBeInTheDocument();
  });

  it("SmartViewsSection renders title", () => {
    render(<SmartViewsSection {...sectionProps} />);
    expect(screen.getByText("Smart Views & Filtering")).toBeInTheDocument();
  });

  it("BatchOperationsSection renders title", () => {
    render(<BatchOperationsSection {...sectionProps} />);
    expect(screen.getByText("Batch Operations")).toBeInTheDocument();
  });

  it("DashboardSection renders title", () => {
    render(<DashboardSection {...sectionProps} />);
    expect(screen.getByText("Dashboard & Analytics")).toBeInTheDocument();
  });

  it("WorkflowsSection renders title", () => {
    render(<WorkflowsSection {...sectionProps} />);
    expect(screen.getByText(/Workflows/)).toBeInTheDocument();
  });

  it("DataPrivacySection renders title", () => {
    render(<DataPrivacySection {...sectionProps} />);
    expect(screen.getByText(/Data & Privacy/)).toBeInTheDocument();
  });

  it("ShortcutsSection renders title", () => {
    render(<ShortcutsSection {...sectionProps} />);
    expect(screen.getByText(/Keyboard Shortcuts/)).toBeInTheDocument();
  });

  it("PwaSection renders title", () => {
    render(<PwaSection {...sectionProps} />);
    expect(
      screen.getByText("PWA (Progressive Web App) Features")
    ).toBeInTheDocument();
  });
});

// ─── AccordionView ──────────────────────────────────────────────────

describe("AccordionView", () => {
  it("renders all section headings", () => {
    render(<AccordionView />);

    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText(/Power Features/)).toBeInTheDocument();
    expect(
      screen.getByText("The Eisenhower Matrix Deep Dive")
    ).toBeInTheDocument();
    expect(screen.getByText("Core Task Management")).toBeInTheDocument();
    expect(screen.getByText(/Advanced Features/)).toBeInTheDocument();
    expect(screen.getByText(/Smart Views/)).toBeInTheDocument();
    expect(screen.getByText("Batch Operations")).toBeInTheDocument();
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    expect(screen.getByText(/Workflows/)).toBeInTheDocument();
    expect(screen.getByText(/Data & Privacy/)).toBeInTheDocument();
    expect(screen.getByText(/Keyboard Shortcuts/)).toBeInTheDocument();
    expect(screen.getByText(/PWA/)).toBeInTheDocument();
  });

  it("renders the final tips section", () => {
    render(<AccordionView />);
    expect(
      screen.getByText(/The Matrix is a Tool, Not a Rule/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Now go get stuff done/)).toBeInTheDocument();
  });
});

// ─── WizardContainer ────────────────────────────────────────────────

describe("WizardContainer", () => {
  const baseProps = {
    currentStep: 1,
    totalSteps: 6,
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onSkip: vi.fn(),
  };

  it("renders children, navigation buttons, and keyboard hint", () => {
    render(
      <WizardContainer {...baseProps}>
        <p>Step content</p>
      </WizardContainer>
    );

    expect(screen.getByText("Step content")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Skip")).toBeInTheDocument();
    expect(screen.getByText(/to navigate/)).toBeInTheDocument();
  });

  it("disables Previous button on first step", () => {
    render(
      <WizardContainer {...baseProps} currentStep={1}>
        <p>First</p>
      </WizardContainer>
    );

    const prevButton = screen.getByText("Previous").closest("button");
    expect(prevButton).toBeDisabled();
  });

  it("shows Finish on last step instead of Next", () => {
    render(
      <WizardContainer {...baseProps} currentStep={6}>
        <p>Last</p>
      </WizardContainer>
    );

    expect(screen.getByText("Finish")).toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("calls onNext when Next is clicked", () => {
    const onNext = vi.fn();
    render(
      <WizardContainer {...baseProps} onNext={onNext} currentStep={2}>
        <p>Middle</p>
      </WizardContainer>
    );

    fireEvent.click(screen.getByText("Next"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when Skip is clicked", () => {
    const onSkip = vi.fn();
    render(
      <WizardContainer {...baseProps} onSkip={onSkip}>
        <p>Content</p>
      </WizardContainer>
    );

    fireEvent.click(screen.getByText("Skip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("handles ArrowRight keyboard navigation", () => {
    const onNext = vi.fn();
    render(
      <WizardContainer {...baseProps} onNext={onNext} currentStep={2}>
        <p>Content</p>
      </WizardContainer>
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("handles ArrowLeft keyboard navigation", () => {
    const onPrevious = vi.fn();
    render(
      <WizardContainer {...baseProps} onPrevious={onPrevious} currentStep={3}>
        <p>Content</p>
      </WizardContainer>
    );

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });
});

// ─── WizardView ─────────────────────────────────────────────────────

describe("WizardView", () => {
  it("renders the first step (Welcome) by default", () => {
    render(<WizardView onComplete={vi.fn()} />);
    expect(
      screen.getByText(/Welcome to GSD Task Manager/)
    ).toBeInTheDocument();
  });

  it("advances to next step when Next is clicked", () => {
    render(<WizardView onComplete={vi.fn()} />);

    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("The Eisenhower Matrix")).toBeInTheDocument();
  });

  it("calls onComplete when finishing the last step", () => {
    const onComplete = vi.fn();
    render(<WizardView onComplete={onComplete} />);

    // Navigate to the last step (step 6)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText("Next"));
    }

    // Now on last step, click Finish
    fireEvent.click(screen.getByText("Finish"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// ─── Wizard Step Components ─────────────────────────────────────────

describe("Wizard Steps", () => {
  it("StepWelcome renders welcome heading and getting started info", () => {
    render(<StepWelcome />);
    expect(
      screen.getByText(/Welcome to GSD Task Manager/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Creating Your First Task/)).toBeInTheDocument();
    expect(screen.getByText(/Pro Tip/)).toBeInTheDocument();
  });

  it("StepMatrix renders quadrant grid and common mistake warning", () => {
    render(<StepMatrix />);
    expect(screen.getByText("The Eisenhower Matrix")).toBeInTheDocument();
    expect(screen.getByText("Q1: Do First")).toBeInTheDocument();
    expect(screen.getByText("Q2: Schedule")).toBeInTheDocument();
    expect(screen.getByText("Q3: Delegate")).toBeInTheDocument();
    expect(screen.getByText("Q4: Eliminate")).toBeInTheDocument();
    expect(
      screen.getByText(/Common Mistake: Living in Q1/)
    ).toBeInTheDocument();
  });

  it("StepTasks renders task management heading", () => {
    render(<StepTasks />);
    expect(screen.getByText(/Task Management/)).toBeInTheDocument();
  });

  it("StepPowerFeatures renders power features heading", () => {
    render(<StepPowerFeatures />);
    expect(screen.getByText("Power Features")).toBeInTheDocument();
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it("StepWorkflows renders workflows heading", () => {
    render(<StepWorkflows />);
    expect(screen.getByText(/Workflows/)).toBeInTheDocument();
  });

  it("StepFinal renders final step content", () => {
    render(<StepFinal />);
    expect(screen.getByText("You're Ready!")).toBeInTheDocument();
    expect(screen.getByText("Your Data, Your Control")).toBeInTheDocument();
    expect(screen.getByText("Essential Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Now Go Get Stuff Done!")).toBeInTheDocument();
  });
});
