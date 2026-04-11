import { LucideIcon } from "lucide-react";
import { useCountUp } from "@/lib/use-count-up";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  insight?: string;
  progressValue?: number;
  progressLabel?: string;
  accentColor?: "blue" | "emerald" | "amber" | "red";
  className?: string;
}

function getAccentClasses(color?: string): {
  iconBg: string;
  iconText: string;
  chipBg: string;
  chipText: string;
  railBg: string;
  railFill: string;
  glow: string;
} {
  const map: Record<string, {
    iconBg: string;
    iconText: string;
    chipBg: string;
    chipText: string;
    railBg: string;
    railFill: string;
    glow: string;
  }> = {
    blue: {
      iconBg: "bg-blue-100/80 dark:bg-blue-900/40",
      iconText: "text-blue-600 dark:text-blue-400",
      chipBg: "bg-blue-500/10",
      chipText: "text-blue-700 dark:text-blue-300",
      railBg: "bg-blue-500/10",
      railFill: "from-blue-500 to-cyan-400",
      glow: "from-blue-500/14 via-blue-500/6 to-transparent",
    },
    emerald: {
      iconBg: "bg-emerald-100/80 dark:bg-emerald-900/40",
      iconText: "text-emerald-600 dark:text-emerald-400",
      chipBg: "bg-emerald-500/10",
      chipText: "text-emerald-700 dark:text-emerald-300",
      railBg: "bg-emerald-500/10",
      railFill: "from-emerald-500 to-teal-400",
      glow: "from-emerald-500/14 via-emerald-500/6 to-transparent",
    },
    amber: {
      iconBg: "bg-amber-100/80 dark:bg-amber-900/40",
      iconText: "text-amber-600 dark:text-amber-400",
      chipBg: "bg-amber-500/10",
      chipText: "text-amber-700 dark:text-amber-300",
      railBg: "bg-amber-500/10",
      railFill: "from-amber-500 to-orange-400",
      glow: "from-amber-500/14 via-amber-500/6 to-transparent",
    },
    red: {
      iconBg: "bg-red-100/80 dark:bg-red-900/40",
      iconText: "text-red-600 dark:text-red-400",
      chipBg: "bg-red-500/10",
      chipText: "text-red-700 dark:text-red-300",
      railBg: "bg-red-500/10",
      railFill: "from-red-500 to-rose-400",
      glow: "from-red-500/14 via-red-500/6 to-transparent",
    },
  };
  if (color && map[color]) return map[color];
  return {
    iconBg: "bg-accent/10",
    iconText: "text-accent",
    chipBg: "bg-accent/10",
    chipText: "text-accent",
    railBg: "bg-accent/10",
    railFill: "from-[rgb(var(--accent))] to-[rgb(var(--accent-hover))]",
    glow: "from-accent/14 via-accent/6 to-transparent",
  };
}

/**
 * Reusable card for displaying a single metric
 */
export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  insight,
  progressValue,
  progressLabel,
  accentColor,
  className = "",
}: StatsCardProps) {
  const animatedValue = useCountUp(value);
  const {
    iconBg,
    iconText,
    chipBg,
    chipText,
    railBg,
    railFill,
    glow,
  } = getAccentClasses(accentColor);
  const clampedProgress = progressValue === undefined
    ? undefined
    : Math.max(0, Math.min(100, progressValue));

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-border/70 bg-card/95 p-6 ${className}`}
      style={{ boxShadow: "var(--shadow-column)" }}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${glow}`} />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
              {title}
            </p>
            {insight ? (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${chipBg} ${chipText}`}>
                {insight}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight text-foreground">
            {animatedValue}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-sm text-foreground-muted">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-3 flex items-center gap-1">
              <span className={`text-xs font-medium ${trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-foreground-muted">from last week</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/40 dark:border-white/5 ${iconBg}`}>
            <Icon className={`h-6 w-6 ${iconText}`} />
          </div>
        )}
      </div>

      {clampedProgress !== undefined ? (
        <div className="relative mt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
              {progressLabel ?? "Progress"}
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {Math.round(clampedProgress)}%
            </span>
          </div>
          <div className={`h-2 rounded-full ${railBg}`}>
            <div
              className={`h-full rounded-full bg-gradient-to-r ${railFill}`}
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
