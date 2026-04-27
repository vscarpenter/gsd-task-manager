"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRightIcon } from "lucide-react";
import { parseCapture } from "@/lib/capture-parser";
import { quadrantByRdKey, type RedesignQuadrantKey } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

export interface CapturePayload {
  title: string;
  urgent: boolean;
  important: boolean;
  tags: string[];
}

interface CaptureBarProps {
  onSubmit: (payload: CapturePayload) => void | Promise<void>;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
}

// Cycle order: null → q1 → q2 → q3 → q4 → null
const CYCLE: (RedesignQuadrantKey | null)[] = ["q1", "q2", "q3", "q4", null];

const ACCENT_BY_KEY: Record<RedesignQuadrantKey, string> = {
  q1: "#c2410c",
  q2: "#1d4ed8",
  q3: "#15803d",
  q4: "#854d0e",
};

function deriveAutoKey(urgent: boolean, important: boolean): RedesignQuadrantKey {
  if (urgent && important) return "q1";
  if (!urgent && important) return "q2";
  if (urgent) return "q3";
  return "q4";
}

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const t = el.tagName;
  return t === "INPUT" || t === "TEXTAREA" || el.isContentEditable;
}

export function CaptureBar({ onSubmit, inputRef: externalRef }: CaptureBarProps) {
  const [text, setText] = useState("");
  const [override, setOverride] = useState<RedesignQuadrantKey | null>(null);
  const internalRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (externalRef) externalRef.current = internalRef.current;
  }, [externalRef]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (isEditable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") {
        e.preventDefault();
        internalRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const parsed = parseCapture(text);
  const autoKey = deriveAutoKey(parsed.urgent, parsed.important);
  const effectiveKey = override ?? autoKey;
  const meta = quadrantByRdKey(effectiveKey);
  const accent = ACCENT_BY_KEY[effectiveKey];

  const cycleQuadrant = () => {
    const idx = CYCLE.indexOf(override);
    setOverride(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!parsed.title) return;
    const flags = override
      ? { urgent: quadrantByRdKey(override).urgent, important: quadrantByRdKey(override).important }
      : { urgent: parsed.urgent, important: parsed.important };
    void onSubmit({
      title: parsed.title,
      urgent: flags.urgent,
      important: flags.important,
      tags: parsed.tags,
    });
    setText("");
    setOverride(null);
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
    else if (e.key === "Tab" && text.trim()) {
      e.preventDefault();
      cycleQuadrant();
    } else if (e.key === "Escape") {
      setText("");
      setOverride(null);
      internalRef.current?.blur();
    }
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5",
        "shadow-sm transition-shadow focus-within:border-foreground-muted focus-within:shadow-md"
      )}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: text.trim() ? accent : "rgb(var(--foreground-muted) / 0.5)" }}
        title={meta.title}
      />
      <input
        ref={internalRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onInputKey}
        placeholder="Capture a task… use ! urgent  * important  #tag"
        aria-label="Capture a task"
        className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] leading-snug text-foreground outline-none placeholder:text-foreground-muted"
      />
      {text.trim() ? (
        <button
          type="button"
          onClick={cycleQuadrant}
          title="Tab to cycle quadrant"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
          {meta.rdShort}
          {override ? <span className="ml-1 font-normal normal-case opacity-60">·fixed</span> : null}
        </button>
      ) : (
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground-muted">
          n
        </span>
      )}
      <button
        type="submit"
        disabled={!parsed.title}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[13px] font-medium",
          "bg-foreground text-background hover:bg-foreground/90",
          "disabled:cursor-not-allowed disabled:opacity-40"
        )}
      >
        Add
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
