import Link from "next/link";
import { ScrollReveal } from "@/components/about/scroll-reveal";

interface FooterCtaProps {
  version: string;
}

export function FooterCta({ version }: FooterCtaProps) {
  return (
    <section className="bg-gradient-to-b from-background-muted/20 to-background py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <ScrollReveal>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
            Ready When You Are
          </p>
          <h2 className="rd-serif mb-4 text-3xl tracking-tight text-foreground sm:text-4xl">
            Ready to get stuff done?
          </h2>
          <p className="mb-8 text-foreground-muted">
            Free. Private. No sign-up required. Open in your browser right now.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-3 text-base font-medium text-white shadow-md shadow-accent/20 transition-colors duration-200 hover:bg-accent-hover"
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
