"use client";

import { useState } from "react";
import {
  GitBranchIcon,
  ServerIcon,
  BotIcon,
  BookOpenIcon,
  ChevronDownIcon,
} from "lucide-react";
import { ViewToggle } from "@/components/view-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { DiagramSection } from "@/components/docs/diagram-section";
import { allDiagramSections } from "@/lib/docs/architecture-diagrams";

type TabId = "all" | "sync" | "worker" | "mcp";

interface Tab {
  id: TabId;
  label: string;
  icon: typeof GitBranchIcon;
  description: string;
}

const tabs: Tab[] = [
  {
    id: "all",
    label: "All Diagrams",
    icon: BookOpenIcon,
    description: "View all architecture diagrams",
  },
  {
    id: "sync",
    label: "Sync Engine",
    icon: GitBranchIcon,
    description: "End-to-end encrypted sync",
  },
  {
    id: "worker",
    label: "Worker Backend",
    icon: ServerIcon,
    description: "Cloudflare Workers API",
  },
  {
    id: "mcp",
    label: "MCP Server",
    icon: BotIcon,
    description: "Claude Desktop integration",
  },
];

/**
 * Documentation page with interactive architecture diagrams
 * Powered by beautiful-mermaid library
 */
export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("all");

  const filteredSections =
    activeTab === "all"
      ? allDiagramSections
      : allDiagramSections.filter((section) => section.id === activeTab);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <ViewToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-border bg-background-muted px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-2">
              <BookOpenIcon className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Architecture Documentation
              </h1>
              <p className="mt-1 text-foreground-muted">
                Interactive diagrams visualizing GSD Task Manager internals
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-6 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-white"
                      : "bg-card text-foreground-muted hover:bg-accent/10 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="space-y-6">
          {filteredSections.map((section, index) => (
            <DiagramSection
              key={section.id}
              title={section.title}
              description={section.description}
              diagrams={section.diagrams}
              defaultExpanded={index === 0}
            />
          ))}
        </div>

        {/* Info Card */}
        <div className="mt-8 rounded-xl border border-border bg-gradient-to-br from-accent/5 to-accent/10 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-accent/10 p-2">
              <ChevronDownIcon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                About These Diagrams
              </h3>
              <p className="mt-1 text-sm text-foreground-muted">
                These diagrams are rendered using the{" "}
                <a
                  href="https://github.com/lukilabs/beautiful-mermaid"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:no-underline"
                >
                  beautiful-mermaid
                </a>{" "}
                library. They automatically adapt to your current theme setting
                and provide an interactive way to understand the GSD Task
                Manager architecture.
              </p>
              <p className="mt-2 text-sm text-foreground-muted">
                For detailed documentation, see the markdown files in the
                repository:{" "}
                <code className="rounded bg-card px-1.5 py-0.5 text-xs">
                  SYNC_ARCHITECTURE.md
                </code>
                ,{" "}
                <code className="rounded bg-card px-1.5 py-0.5 text-xs">
                  WORKER_ARCHITECTURE.md
                </code>
                , and{" "}
                <code className="rounded bg-card px-1.5 py-0.5 text-xs">
                  MCP_ARCHITECTURE.md
                </code>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
