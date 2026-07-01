"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRightIcon, ZapIcon } from "lucide-react";
import { parseCapture } from "@/lib/capture-parser";
import { quadrantByRdKey, QUADRANT_ACCENT, type RedesignQuadrantKey } from "@/lib/quadrants";
import { cn } from "@/lib/utils";

export interface CapturePayload {
  title: string;
  urgent: boolean;
  important: boolean;
  tags: string[];
}

interface CaptureBarProps {
  onSubmit: (payload: CapturePayload) => void | Promise<void>;
  /** Called when the user wants to open the full new-task drawer (Shift+N or "Details" button). */
  onMoreOptions?: (payload: CapturePayload) => void;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
}

// Cycle order: null → q1 → q2 → q3 → q4 → null
const CYCLE: (RedesignQuadrantKey | null)[] = ["q1", "q2", "q3", "q4", null];

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

export function CaptureBar({ onSubmit, onMoreOptions, inputRef: externalRef }: CaptureBarProps) {
  const [text, setText] = useState("");
  const [override, setOverride] = useState<RedesignQuadrantKey | null>(null);
  // Fires the lightning-glyph pop on a real capture; self-clears on animation end.
  const [justCaptured, setJustCaptured] = useState(false);
  const internalRef = useRef<HTMLInputElement | null>(null);

  // Stable refs so the global keydown handler does not re-register on every keystroke.
  const textRef = useRef(text);
  const overrideRef = useRef(override);
  const onMoreOptionsRef = useRef(onMoreOptions);

  useEffect(() => {
    textRef.current = text;
    overrideRef.current = override;
    onMoreOptionsRef.current = onMoreOptions;
  }, [text, override, onMoreOptions]);

  // Merge the internal and (optional) external refs via a ref callback so the
  // parent's ref points at the input without a syncing effect.
  const setInputRef = (node: HTMLInputElement | null) => {
    internalRef.current = node;
    if (externalRef) externalRef.current = node;
  };

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (isEditable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") {
        e.preventDefault();
        internalRef.current?.focus();
      } else if (e.key === "N" && e.shiftKey) {
        e.preventDefault();
        const currentParsed = parseCapture(textRef.current);
        const ov = overrideRef.current;
        const flags = ov
          ? { urgent: quadrantByRdKey(ov).urgent, important: quadrantByRdKey(ov).important }
          : { urgent: currentParsed.urgent, important: currentParsed.important };
        onMoreOptionsRef.current?.({
          title: currentParsed.title || "",
          urgent: flags.urgent,
          important: flags.important,
          tags: currentParsed.tags,
        });
        if (textRef.current.trim()) {
          setText("");
          setOverride(null);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const parsed = parseCapture(text);
  const autoKey = deriveAutoKey(parsed.urgent, parsed.important);
  const effectiveKey = override ?? autoKey;
  const meta = quadrantByRdKey(effectiveKey);
  const accent = QUADRANT_ACCENT[effectiveKey];

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
    setJustCaptured(true);
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
      data-testid="capture-bar"
      onSubmit={submit}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5",
        // Flat at rest on the hairline; lifts only when engaged (Inkwell flat-at-rest signature).
        "transition-shadow focus-within:border-foreground-muted focus-within:shadow-lg"
      )}
    >
      <ZapIcon
        aria-hidden
        onAnimationEnd={() => setJustCaptured(false)}
        className={cn("h-4 w-4 shrink-0 transition-colors", justCaptured && "animate-capture-pop")}
        style={{ color: text.trim() ? accent : "color-mix(in srgb, var(--gray-500) 70%, transparent)" }}
      />
      <input
        data-testid="capture-input"
        ref={setInputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onInputKey}
        placeholder="Capture a task..."
        aria-label="Capture a task"
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] leading-snug text-foreground outline-none placeholder:text-foreground-muted"
      />
      {text.trim() ? (
        <>
          <button
            data-testid="quadrant-toggle"
            key={effectiveKey}
            type="button"
            onClick={cycleQuadrant}
            title="Tab to cycle quadrant"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium animate-quadrant-pill-in"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
              color: accent,
            }}
          >
            <span
              className="h-[5px] w-[5px] rounded-full bg-current"
              aria-hidden
            />
            {meta.title}
            {override ? <span className="ml-1 font-normal normal-case opacity-60">·fixed</span> : null}
          </button>
          {onMoreOptions ? (
            <button
              data-testid="more-options"
              type="button"
              onClick={() => {
                const flags = override
                  ? { urgent: quadrantByRdKey(override).urgent, important: quadrantByRdKey(override).important }
                  : { urgent: parsed.urgent, important: parsed.important };
                onMoreOptions({ title: parsed.title || "", urgent: flags.urgent, important: flags.important, tags: parsed.tags });
                setText("");
                setOverride(null);
              }}
              title="Open full form (Shift+N)"
              aria-label="Open full task form"
              // Enters just behind the quadrant pill (40ms) so the trailing controls
              // arrive as one coherent cluster instead of the pill animating alone.
              style={{ animationDelay: "40ms" }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground animate-quadrant-pill-in"
            >
              Details ↗
            </button>
          ) : null}
        </>
      ) : (
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground-muted">
          n
        </span>
      )}
      <button
        data-testid="submit-task"
        type="submit"
        aria-disabled={!parsed.title}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[14px] font-semibold transition-[background-color,color,transform] duration-[120ms]",
          parsed.title
            ? "bg-accent text-card hover:bg-accent-hover active:scale-[0.97]"
            : "bg-accent/15 text-accent hover:bg-accent/20"
        )}
      >
        Add
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
