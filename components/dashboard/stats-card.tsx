import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  accentColor?: "blue" | "emerald" | "amber" | "red";
  className?: string;
}

function getAccentClasses(color?: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-600 dark:text-blue-400" },
    emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-600 dark:text-emerald-400" },
    amber: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-600 dark:text-amber-400" },
    red: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-600 dark:text-red-400" },
  };
  if (color && map[color]) return map[color];
  return { bg: "bg-accent/10", text: "text-accent" };
}

/**
 * Reusable card for displaying a single metric
 */
export function StatsCard({ title, value, subtitle, icon: Icon, trend, accentColor, className = "" }: StatsCardProps) {
  const { bg: iconBg, text: iconText } = getAccentClasses(accentColor);
  return (
    <div className={`rounded-xl border border-border bg-card p-6 shadow-sm ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground-muted">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-foreground-muted">from last week</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`rounded-lg p-3 ${iconBg}`}>
            <Icon className={`h-6 w-6 ${iconText}`} />
          </div>
        )}
      </div>
    </div>
  );
}
