import Link from "next/link";
import { Lock, Monitor, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/about/scroll-reveal";

/**
 * Hero section for the About / marketing page.
 * Centered single-column layout with headline, CTAs, and trust signals.
 */
export function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-background to-background-muted/30 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <p className="mb-4 text-xs uppercase tracking-[0.24em] text-foreground-muted">
            Productivity Framework
          </p>

          <h1 className="rd-serif mb-6 text-4xl tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Stop juggling.
            <br />
            Start finishing.
          </h1>

          <p className="mx-auto mb-10 max-w-[56ch] text-lg leading-relaxed text-foreground-muted">
            GSD Task Manager uses the Eisenhower Matrix to help you sort what&apos;s
            urgent from what&apos;s important — so you can focus on what actually
            moves the needle.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className={cn(
                "inline-flex items-center justify-center gap-2",
                "rounded-full px-6 py-3 text-sm font-medium",
                "transition-colors duration-200",
                "bg-accent hover:bg-accent-hover text-white",
                "shadow-md shadow-accent/20"
              )}
            >
              Open App &rarr;
            </Link>

            <a
              href="#how-it-works"
              className={cn(
                "inline-flex items-center justify-center gap-2",
                "rounded-full border border-border px-6 py-3 text-sm font-medium",
                "transition-colors duration-200",
                "bg-card text-foreground-muted hover:bg-background-muted hover:text-foreground"
              )}
            >
              Learn how it works
            </a>
          </div>

          {/* Trust signals */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-foreground-muted">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={16} />
              No account required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Monitor size={16} />
              Works offline
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Code2 size={16} />
              MIT open source
            </span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
