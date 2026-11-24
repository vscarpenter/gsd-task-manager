import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  /** Plain-text comparison, e.g. "12% above your recent pace". Never a pill, never coloured. */
  note?: string;
  /** Volume context, e.g. "20 completed in 7 days". Rendered after the note. */
  meta?: string;
  icon?: LucideIcon;
  className?: string;
}

/**
 * A single measurement in the review's hero rail.
 *
 * Deliberately borderless: the hero band groups these behind hairline dividers,
 * because three bordered cards side by side rebuild the equal-weight card grid
 * that reads as a generic SaaS dashboard. Hierarchy on this page comes from the
 * verdict above, not from tinting one of these three.
 */
export function StatsCard({
  title,
  value,
  note,
  meta,
  icon: Icon,
  className,
}: StatsCardProps) {
  const animatedValue = useCountUp(value);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden />}
        <p className="text-eyebrow font-semibold uppercase text-foreground-muted">{title}</p>
      </div>

      {/* 40px, not 48: at this weight the metric already dominates its column,
          and the serif verdict above owns the page's largest voice. */}
      <p
        className="mt-3 text-numeral text-foreground"
      >
        {animatedValue}
      </p>

      {note || meta ? (
        <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
          {note}
          {note && meta ? " · " : ""}
          {meta}
        </p>
      ) : null}
    </div>
  );
}
