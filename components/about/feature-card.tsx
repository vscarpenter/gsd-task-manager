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
      "rounded-2xl border border-card-border bg-card p-6 transition-all duration-200",
      "hover:border-border hover:bg-background-muted/40",
      className
    )}>
      <Icon className="h-5 w-5 text-accent mb-3" aria-hidden="true" />
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-foreground-muted leading-relaxed">{description}</p>
    </div>
  );
}
