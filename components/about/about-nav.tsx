import Image from "next/image";
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
        "backdrop-blur-xl bg-background/85",
        "border-b border-border/60"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
          <Image
            src="/icons/about-logo.png"
            alt="GSD logo"
            width={42}
            height={42}
            className="rounded-lg"
          />
          <span className="text-accent">GSD</span>
        </span>

        <Link
          href="/"
          className={cn(
            "inline-flex items-center justify-center gap-2",
            "rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground",
            "transition-colors duration-200 hover:border-foreground/15 hover:bg-background-muted"
          )}
        >
          Open App
        </Link>
      </div>
    </nav>
  );
}
