import Link from "next/link";
import { ScrollReveal } from "@/components/about/scroll-reveal";

interface FooterCtaProps {
  version: string;
}

export function FooterCta({ version }: FooterCtaProps) {
  return (
    <section className="py-20 sm:py-28 bg-background-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-4">
            Ready to get stuff done?
          </h2>
          <p className="text-foreground-muted mb-8">
            Free. Private. No sign-up required. Open in your browser right now.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-base font-medium transition-all duration-200 bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30"
          >
            Open GSD Task Manager &rarr;
          </Link>
          <p className="mt-12 text-xs text-foreground-muted">
            Built by Vinny Carpenter &middot; MIT License &middot; v{version}{" "}
            &middot; gsd.vinny.dev
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
