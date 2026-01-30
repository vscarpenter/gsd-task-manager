"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { MermaidDiagram } from "./mermaid-diagram";

interface DiagramItem {
  id: string;
  title: string;
  description?: string;
  code: string;
}

interface DiagramSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Array of diagrams in this section */
  diagrams: DiagramItem[];
  /** Whether the section starts expanded */
  defaultExpanded?: boolean;
}

/**
 * Collapsible section containing multiple Mermaid diagrams
 */
export function DiagramSection({
  title,
  description,
  diagrams,
  defaultExpanded = false,
}: DiagramSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border border-border bg-background-muted">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-accent/5"
      >
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-foreground-muted">{description}</p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          {isExpanded ? (
            <ChevronDownIcon className="h-5 w-5 text-foreground-muted" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-foreground-muted" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border px-5 py-4">
          <div className="space-y-6">
            {diagrams.map((diagram) => (
              <MermaidDiagram
                key={diagram.id}
                code={diagram.code}
                title={diagram.title}
                description={diagram.description}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
