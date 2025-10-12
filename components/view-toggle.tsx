"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGridIcon, BarChart3Icon } from "lucide-react";

/**
 * Toggle between Matrix and Dashboard views
 */
export function ViewToggle() {
  const pathname = usePathname();
  const isMatrix = pathname === "/";
  const isDashboard = pathname === "/dashboard";

  return (
    <div className="inline-flex rounded-lg border border-border bg-background-muted p-1">
      <Link
        href="/"
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
          isMatrix
            ? "bg-background text-foreground shadow-sm"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        <LayoutGridIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Matrix</span>
      </Link>
      <Link
        href="/dashboard"
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
          isDashboard
            ? "bg-background text-foreground shadow-sm"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        <BarChart3Icon className="h-4 w-4" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>
    </div>
  );
}
