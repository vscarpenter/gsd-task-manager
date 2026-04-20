import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
  return (
    <div className={cn(
      "rounded-[24px] border border-border/70 bg-card/95 p-6 transition-colors duration-200",
      "hover:border-foreground/10 hover:bg-background-muted/35",
      className
    )}>
      <Icon className="mb-4 h-5 w-5 text-accent" aria-hidden="true" />
      <h3
        className="mb-2 text-xl tracking-tight text-foreground"
        style={{ fontFamily: "var(--font-instrument-serif, ui-serif, Georgia, serif)" }}
      >
        {title}
      </h3>
      <p className="text-sm text-foreground-muted leading-relaxed">{description}</p>
    </div>
  );
}
