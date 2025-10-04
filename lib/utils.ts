import { clsx } from "clsx";

export function cn(...classNames: Array<string | undefined | false | null>): string {
  return clsx(classNames);
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function formatDueDate(value?: string): string {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
}

export function formatRelative(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  const dayDelta = Math.round(diff / dayMs);

  if (Math.abs(dayDelta) > 6) {
    return formatDueDate(value);
  }

  return formatter.format(dayDelta, "day");
}
