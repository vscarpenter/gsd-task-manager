import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  /** Footer meta string, e.g. "20 / 7d". Sits next to the trend delta. */
  footerMeta?: string;
  icon?: LucideIcon;
  trend?: {
    /** Percentage delta vs previous period. */
    value: number;
    isPositive: boolean;
    /** Comparison label, e.g. "vs last week". Defaults to "vs last week". */
    label?: string;
  };
  /** Neutral status pill copy ("Holding steady", "3 overdue"). */
  insight?: string;
  /** 7–12 numeric points rendered as the inline sparkline. */
  series?: number[];
  className?: string;
}

/**
 * Unified stat card. One rhythm: eyebrow → neutral pill → serif hero number →
 * footer (delta + meta) → sparkline. Color is reserved for state deltas only.
 */
export function StatsCard({
  title,
  value,
  footerMeta,
  icon: Icon,
  trend,
  insight,
  series,
  className,
}: StatsCardProps) {
  const animatedValue = useCountUp(value);
  const trendColor = trend
    ? trend.isPositive
      ? "text-status-success"
      : "text-status-overdue"
    : "text-foreground-muted";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-hair border-border bg-card p-6",
        className
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-label font-semibold uppercase text-foreground-muted">
              {title}
            </p>
            {insight ? (
              <span className="inline-flex rounded-full bg-background-muted px-2 py-0.5 text-[10px] font-medium text-foreground-muted">
                {insight}
              </span>
            ) : null}
          </div>
          <p className="rd-serif mt-3 text-[48px] leading-none tabular-nums tracking-tight text-foreground">
            {animatedValue}
          </p>
        </div>
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <Icon className="h-4 w-4 text-accent" aria-hidden />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs">
        {trend ? (
          <span className={cn("font-medium tabular-nums", trendColor)}>
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
        ) : null}
        {trend ? (
          <span className="text-foreground-muted">{trend.label ?? "vs last week"}</span>
        ) : null}
        {footerMeta ? (
          <>
            {trend ? <span className="text-foreground-muted/60">·</span> : null}
            <span className="text-foreground-muted">{footerMeta}</span>
          </>
        ) : null}
      </div>

      {series && series.length > 1 ? (
        <Sparkline
          values={series}
          isPositive={trend ? trend.isPositive : undefined}
        />
      ) : null}
    </div>
  );
}

/**
 * Inline SVG sparkline. Stroke color follows the trend delta:
 * success (up), overdue (down), muted (flat / no trend).
 */
function Sparkline({
  values,
  isPositive,
}: {
  values: number[];
  isPositive?: boolean;
}) {
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

  const stroke =
    isPositive === undefined
      ? "stroke-foreground-muted"
      : isPositive
        ? "stroke-status-success"
        : "stroke-status-overdue";

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
        className={stroke}
      />
    </svg>
  );
}
