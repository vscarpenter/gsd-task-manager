import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Set when the capability is built but has no way to reach it yet. */
  badge?: string;
  className?: string;
}

export function FeatureCard({ icon: Icon, title, description, badge, className }: FeatureCardProps) {
  return (
    <div className={cn(
      "rounded-[24px] border border-border/70 bg-card/95 p-6 transition-colors duration-200",
      "hover:border-foreground/10 hover:bg-background-muted/35",
      className
    )}>
      <div className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-accent/10">
        <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
      </div>
      <h3 className="mb-2 flex flex-wrap items-center gap-2 text-h3 font-semibold tracking-tight text-foreground">
        {title}
        {/* Explicit space: JSX drops newline whitespace between expressions, and
            without it the accessible name runs together as "SubtasksComing soon". */}
        {badge ? " " : null}
        {badge ? (
          // Deliberately quiet: this marks an absence, so it must not compete
          // with the shipped features around it.
          <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
            {badge}
          </span>
        ) : null}
      </h3>
      <p className="text-sm text-foreground-muted leading-relaxed">{description}</p>
    </div>
  );
}
