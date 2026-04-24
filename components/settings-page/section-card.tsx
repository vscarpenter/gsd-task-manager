"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionCardProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}

/**
 * Single-section container for the settings page.
 * Large editorial-style header with a quiet body that hosts the reused
 * iOS-style SettingsRow/SettingsSelectRow components in a divided list.
 */
export function SectionCard({ eyebrow, title, description, icon: Icon, children }: SectionCardProps) {
  return (
    <section
      aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className="overflow-hidden rounded-[28px] border border-border/70 bg-card/95 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
    >
      <header className="flex items-start gap-4 border-b border-border/60 bg-gradient-to-b from-background to-background-muted/30 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/15">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
            {eyebrow}
          </p>
          <h2
            id={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
            className="rd-serif mt-2 text-[2rem] tracking-tight text-foreground"
          >
            {title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
            {description}
          </p>
        </div>
      </header>

      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
