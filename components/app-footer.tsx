"use client";

export function AppFooter() {
  const buildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER || "dev";
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE || "unknown";

  return (
    <footer className="mt-10 border-t border-slate-200 px-6 py-6 text-xs text-slate-600">
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
        {" · "}
        <span className="text-slate-500">
          Build {buildNumber} · {buildDate}
        </span>
      </p>
    </footer>
  );
}
