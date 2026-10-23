"use client";

import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * Single-section container for the settings page: a title and description over
 * the reused iOS-style SettingsRow/SettingsSelectRow components in a divided
 * list. The sidebar already shows each section's group and icon beside it, so
 * the header does not repeat them.
 */
export function SectionCard({ title, description, children }: SectionCardProps) {
  const headingId = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-lg border border-border/70 bg-card/95"
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      <header className="border-b border-border/60 px-6 py-6 sm:px-8 sm:py-7">
        <h2 id={headingId} className="text-h2 text-foreground">
          {title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
          {description}
        </p>
      </header>

      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
