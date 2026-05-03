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
      <div className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-accent/10">
        <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
      </div>
      <h3 className="rd-serif mb-2 text-xl tracking-tight text-foreground">
        {title}
      </h3>
      <p className="text-sm text-foreground-muted leading-relaxed">{description}</p>
    </div>
  );
}
