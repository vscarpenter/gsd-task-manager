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
    <section className="py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <p className="text-xs uppercase tracking-widest text-foreground-muted mb-4">
            Productivity Framework
          </p>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
            Stop juggling.
            <br />
            Start finishing.
          </h1>

          <p className="text-lg text-foreground-muted max-w-[60ch] mx-auto mb-10">
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
                "transition-all duration-200",
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
                "rounded-full px-6 py-3 text-sm font-medium",
                "transition-all duration-200",
                "text-foreground-muted hover:text-foreground",
                "hover:bg-background-muted"
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
