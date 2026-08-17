"use client";

import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

const COPY_FEEDBACK_MS = 2000;

const BUTTON_LABEL: Record<CopyState, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Copy failed",
};

interface TerminalBlockProps {
  label: string;
  code: string;
}

/**
 * Dark code panel with a title bar and one-click copy, for install/config
 * snippets on marketing surfaces. The panel keeps a fixed dark surface in
 * both themes (--terminal-* tokens), so the white-alpha borders in here are
 * safe — they never sit on a light ground.
 */
export function TerminalBlock({ label, code }: TerminalBlockProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
  };

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--terminal-bg)] text-[var(--terminal-ink)] shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 py-2 pl-4 pr-2.5">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full border border-current opacity-50" />
            <span className="h-2 w-2 rounded-full border border-current opacity-50" />
            <span className="h-2 w-2 rounded-full border border-current opacity-50" />
          </span>
          <span className="kicker truncate text-[var(--terminal-muted)]">
            {label}
          </span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-live="polite"
          className="kicker min-h-8 shrink-0 cursor-pointer rounded-md border border-white/25 px-3 transition-colors pointer-coarse:min-h-11 hover:border-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--terminal-ink)]"
        >
          {BUTTON_LABEL[copyState]}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 sm:p-5">
        <code className="font-mono text-sm leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}
