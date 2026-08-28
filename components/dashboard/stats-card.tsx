import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  /** Plain-text comparison, e.g. "12% above your recent pace". Never a pill, never coloured. */
  note?: string;
  /** Volume context, e.g. "20 closed in 7 days". Rendered after the note. */
  meta?: string;
  icon?: LucideIcon;
  /** 7–12 numeric points rendered as the inline sparkline. */
  series?: number[];
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
  series,
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
        className="mt-3 text-[40px] font-semibold leading-none tabular-nums text-foreground"
        style={{ letterSpacing: "-0.02em" }}
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

      {series && series.length > 1 ? <Sparkline values={series} /> : null}
    </div>
  );
}

/**
 * Inline SVG sparkline in a single neutral ink.
 *
 * Direction is deliberately uncoloured: a seven-point series is context, not a
 * verdict, and colour on this page is reserved for quadrant identity and status.
 * --ink-hint, not --ink-3: the handoff's #9AA5AE measures 2.48:1 on the card,
 * under the 3:1 floor for a graphic that carries meaning (WCAG 1.4.11).
 */
function Sparkline({ values }: { values: number[] }) {
  const width = 120;
  const height = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((value, i) => {
      const x = i * step;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 h-7 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-ink-hint"
      />
    </svg>
  );
}
