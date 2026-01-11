/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState } from "react";
import { LightbulbIcon } from "lucide-react";
import { GettingStartedSection } from "@/components/user-guide/getting-started-section";
import { PowerFeaturesSection } from "@/components/user-guide/power-features-section";
import { MatrixSection } from "@/components/user-guide/matrix-section";
import { TaskManagementSection } from "@/components/user-guide/task-management-section";
import { AdvancedFeaturesSection } from "@/components/user-guide/advanced-features-section";
import { SmartViewsSection } from "@/components/user-guide/smart-views-section";
import { BatchOperationsSection } from "@/components/user-guide/batch-operations-section";
import { DashboardSection } from "@/components/user-guide/dashboard-section";
import { WorkflowsSection } from "@/components/user-guide/workflows-section";
import { DataPrivacySection } from "@/components/user-guide/data-privacy-section";
import { ShortcutsSection } from "@/components/user-guide/shortcuts-section";
import { PwaSection } from "@/components/user-guide/pwa-section";

/**
 * Accordion-style view for the user guide
 * Shows all sections as collapsible accordions for quick reference
 */
export function AccordionView() {
  const [expandedSections, setExpandedSections] = useState({
    gettingStarted: true,
    powerFeatures: false,
    matrix: false,
    taskManagement: false,
    advancedFeatures: false,
    smartViews: false,
    batchOps: false,
    dashboard: false,
    workflows: false,
    dataPrivacy: false,
    shortcuts: false,
    pwa: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="space-y-2">
      <GettingStartedSection
        expanded={expandedSections.gettingStarted}
        onToggle={() => toggleSection("gettingStarted")}
      />

      <PowerFeaturesSection
        expanded={expandedSections.powerFeatures}
        onToggle={() => toggleSection("powerFeatures")}
      />

      <MatrixSection
        expanded={expandedSections.matrix}
        onToggle={() => toggleSection("matrix")}
      />

      <TaskManagementSection
        expanded={expandedSections.taskManagement}
        onToggle={() => toggleSection("taskManagement")}
      />

      <AdvancedFeaturesSection
        expanded={expandedSections.advancedFeatures}
        onToggle={() => toggleSection("advancedFeatures")}
      />

      <SmartViewsSection
        expanded={expandedSections.smartViews}
        onToggle={() => toggleSection("smartViews")}
      />

      <BatchOperationsSection
        expanded={expandedSections.batchOps}
        onToggle={() => toggleSection("batchOps")}
      />

      <DashboardSection
        expanded={expandedSections.dashboard}
        onToggle={() => toggleSection("dashboard")}
      />

      <WorkflowsSection
        expanded={expandedSections.workflows}
        onToggle={() => toggleSection("workflows")}
      />

      <DataPrivacySection
        expanded={expandedSections.dataPrivacy}
        onToggle={() => toggleSection("dataPrivacy")}
      />

      <ShortcutsSection
        expanded={expandedSections.shortcuts}
        onToggle={() => toggleSection("shortcuts")}
      />

      <PwaSection
        expanded={expandedSections.pwa}
        onToggle={() => toggleSection("pwa")}
      />

      {/* Final Tips */}
      <div className="rounded-lg bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 p-4 mt-4">
        <div className="flex items-start gap-3">
          <LightbulbIcon className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <h4 className="font-semibold text-foreground">
              Remember: The Matrix is a Tool, Not a Rule
            </h4>
            <p className="text-foreground-muted">
              There's no "perfect" way to use GSD. Experiment with
              workflows, adjust quadrants as you learn, and adapt the system
              to your life. The goal isn't perfect categorization—it's
              intentional action toward what matters most.
            </p>
            <p className="text-foreground-muted">
              <strong>Start small.</strong> Master one section at a time.
              Even using just the basic matrix will transform your
              productivity. The advanced features are here when you're
              ready.
            </p>
            <p className="text-accent font-medium">
              Now go get stuff done!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
