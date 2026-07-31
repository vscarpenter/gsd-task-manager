"use client";

export function AppFooter() {
  const buildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER || "dev";
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE || "unknown";

  return (
    <footer
      className="border-t border-border/70 bg-background px-4 py-3 text-xs text-foreground-muted sm:px-9"
    >
      <p className="text-center">
        Created by{" "}
        <a
          href="https://vinny.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xs text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {/* Non-breaking space keeps the name whole — at 320px the footer
              otherwise breaks it as "Vinny / Carpenter". */}
          Vinny&nbsp;Carpenter
        </a>
        <span aria-hidden="true">{" · "}</span>
        <span className="text-foreground-muted/70">
          v{buildNumber} · {buildDate}
        </span>
      </p>
    </footer>
  );
}
