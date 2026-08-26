import Link from "next/link";
import { Lock, Monitor, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/about/scroll-reveal";

const APP_STORE_URL = "https://apps.apple.com/app/id6776731612";

const ctaBase = cn(
  "inline-flex items-center justify-center gap-2",
  "rounded-full px-6 py-3 text-sm font-medium",
  "transition-colors duration-200"
);

/** Bordered pill for the two actions that sit beside the primary CTA. */
const secondaryCta = cn(
  ctaBase,
  "border border-border",
  "bg-card text-foreground-muted hover:bg-background-muted hover:text-foreground"
);

function HeroCtas() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <Link
        href="/"
        className={cn(
          ctaBase,
          "bg-accent text-on-accent hover:bg-accent-hover",
          "shadow-md shadow-accent/20"
        )}
      >
        Open App &rarr;
      </Link>

      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={secondaryCta}
      >
        Get the iOS app
      </a>

      <a href="#how-it-works" className={secondaryCta}>
        Learn how it works
      </a>
    </div>
  );
}

/**
 * Hero section for the About / marketing page.
 * Centered single-column layout with headline, CTAs, and trust signals.
 */
export function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-background to-background-muted/30 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <p className="kicker mb-4 text-foreground-muted">
            Productivity Framework
          </p>

          <h1 className="mb-6 text-[clamp(2.75rem,1.2rem+5.2vw,5rem)] font-serif font-semibold leading-[1.05] tracking-tight text-foreground">
            Stop juggling.
            <br />
            Start finishing.
          </h1>

          <p className="mx-auto mb-10 max-w-[56ch] text-lg leading-relaxed text-foreground-muted">
            GSD Task Manager uses the Eisenhower Matrix to help you sort what&apos;s
            urgent from what&apos;s important — so you can focus on what actually
            moves the needle.
          </p>

          <HeroCtas />

          {/* Trust signals — hairline divider above frames the row visually */}
          <div className="mx-auto mt-12 max-w-2xl border-t border-border-muted pt-6">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-caption text-foreground-muted">
              <span className="inline-flex items-center gap-1.5">
                <Lock size={16} strokeWidth={1.75} aria-hidden />
                No account required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Monitor size={16} strokeWidth={1.75} aria-hidden />
                Works offline
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Code2 size={16} strokeWidth={1.75} aria-hidden />
                MIT open source
              </span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
