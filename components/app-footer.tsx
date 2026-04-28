"use client";

export function AppFooter() {
  const buildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER || "dev";
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE || "unknown";

  return (
    <footer
      className="border-t border-border/70 bg-background px-4 py-3 text-xs text-foreground-muted sm:px-9"
      role="contentinfo"
    >
      <p className="text-center">
        Created by{" "}
        <a
          href="https://vinny.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Vinny Carpenter
        </a>
        <span aria-hidden="true">{" · "}</span>
        <span className="text-foreground-muted/70">
          v{buildNumber} · {buildDate}
        </span>
      </p>
    </footer>
  );
}
