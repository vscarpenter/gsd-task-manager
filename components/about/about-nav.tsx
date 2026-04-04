import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Slim sticky navigation bar for the About / marketing page.
 * Server component — no client-side interactivity needed.
 */
export function AboutNav() {
  return (
    <nav
      className={cn(
        "sticky top-0 z-50",
        "backdrop-blur-xl bg-background/80",
        "border-b border-border"
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        <span className="text-lg font-bold tracking-tight text-foreground">
          <span className="text-accent">GSD</span>
        </span>

        <Link
          href="/"
          className={cn(
            "inline-flex items-center justify-center gap-2",
            "rounded-full px-4 py-2 text-sm font-medium",
            "transition-all duration-200",
            "bg-accent hover:bg-accent-hover text-white",
            "shadow-md shadow-accent/20"
          )}
        >
          Open App
        </Link>
      </div>
    </nav>
  );
}
