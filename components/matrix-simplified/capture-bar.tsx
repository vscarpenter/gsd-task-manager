"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRightIcon, ArrowUpRightIcon, ZapIcon } from "lucide-react";
import { parseCapture } from "@/lib/capture-parser";
import {
  quadrantByRdKey,
  QUADRANT_ACCENT,
  QUADRANT_HEADER,
  QUADRANT_INK,
  type RedesignQuadrantKey,
} from "@/lib/quadrants";
import { cn } from "@/lib/utils";
import { hasOpenModal, isEditableShortcutTarget } from "@/lib/use-app-shortcuts";

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
      if (
        e.defaultPrevented ||
        e.repeat ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (isEditableShortcutTarget(e.target) || isEditableShortcutTarget(document.activeElement)) ||
        hasOpenModal()
      ) return;
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
  const ink = QUADRANT_INK[effectiveKey];

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
    else if (e.key === "Escape") {
      internalRef.current?.blur();
    }
  };

  return (
    <form
      data-testid="capture-bar"
      onSubmit={submit}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 rounded-xl border border-border bg-card px-3 py-2.5 sm:flex sm:gap-3 sm:px-4 sm:py-3.5",
        // Flat at rest on the hairline; lifts only when engaged (Inkwell flat-at-rest signature).
        "transition-shadow focus-within:border-foreground-muted focus-within:shadow-lg",
        // The input clears its own outline, so the bar carries the focus ring for
        // it. A lift alone is not a focus indicator — it disappears under
        // forced-colors and reads as decoration rather than position.
        "focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2"
      )}
    >
      <ZapIcon
        aria-hidden
        onAnimationEnd={() => setJustCaptured(false)}
        className={cn("col-start-1 row-start-1 h-4 w-4 shrink-0 transition-colors", justCaptured && "animate-capture-pop")}
        style={{ color: text.trim() ? accent : "color-mix(in srgb, var(--gray-500) 70%, transparent)" }}
      />
      <input
        data-testid="capture-input"
        ref={setInputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onInputKey}
        placeholder="Capture a task…"
        aria-label="Capture a task"
        // The focus indicator lives on the parent <form> (focus-within:ring-2
        // ring-accent), which is the visible affordance for this borderless
        // input. The rule matches per element and cannot see the parent.
        // ui-craft-detect-ignore-next-line
        className="touch-target col-start-2 row-start-1 min-w-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-foreground-muted sm:text-body"
      />
      {text.trim() ? (
        <>
          <button
            data-testid="quadrant-toggle"
            key={effectiveKey}
            type="button"
            onClick={cycleQuadrant}
            title="Choose task destination"
            className="touch-target col-start-2 row-start-2 inline-flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-0.5 text-caption font-medium animate-quadrant-pill-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:col-auto sm:row-auto"
            style={{
              backgroundColor: QUADRANT_HEADER[effectiveKey],
              color: ink,
            }}
          >
            <span
              className="h-[5px] w-[5px] rounded-full bg-current"
              aria-hidden
            />
            {meta.title}
            {override ? <span className="ml-1 font-normal normal-case">·fixed</span> : null}
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
              className="touch-target col-start-3 row-start-2 inline-flex items-center gap-1 justify-self-end rounded-md px-2 py-1 text-caption font-medium text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 animate-quadrant-pill-in sm:col-auto sm:row-auto"
            >
              Details
              <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </>
      ) : (
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-caption text-foreground-muted sm:inline-flex">
          n
        </kbd>
      )}
      <button
        data-testid="submit-task"
        type="submit"
        aria-disabled={!parsed.title}
        className={cn(
          "touch-target col-start-3 row-start-1 inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-body font-semibold transition-[background-color,color,transform] duration-[120ms] sm:col-auto sm:row-auto sm:h-9 sm:px-4",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          parsed.title
            ? "bg-accent text-on-accent hover:bg-accent-hover active:scale-[0.97]"
            : "bg-accent/15 text-accent hover:bg-accent/20"
        )}
      >
        Add
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
